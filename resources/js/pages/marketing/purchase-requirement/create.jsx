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
import { ArrowLeft, Check, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/purchase-requirement' },
    { title: 'Tambah PR', href: '/marketing/purchase-requirement/create' },
];

const todayValue = () => {
    const date = new Date();
    return date.toISOString().slice(0, 10);
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
    const total = parseNumber(item?.stokG1 ?? item?.stok_g1) +
        parseNumber(item?.stokG2 ?? item?.stok_g2) +
        parseNumber(item?.stokG3 ?? item?.stok_g3) +
        parseNumber(item?.stokG4 ?? item?.stok_g4) +
        parseNumber(item?.mib) +
        parseNumber(item?.mibs) +
        parseNumber(item?.pr_outstanding) +
        parseNumber(item?.po_outstanding) -
        parseNumber(item?.do_outstanding);
    return total;
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

    const customerTotalPages = useMemo(() => {
        if (customerPageSize === Infinity) {
            return 1;
        }
        return Math.max(1, Math.ceil(customerTotal / customerPageSize));
    }, [customerTotal, customerPageSize]);

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
            if (customerSearchTerm.trim()) {
                params.set('search', customerSearchTerm.trim());
            }

            const response = await fetch(
                `/marketing/purchase-requirement/customers?${params.toString()}`,
                { headers: { Accept: 'application/json' } },
            );

            if (!response.ok) {
                throw new Error('Request failed');
            }

            const data = await response.json();
            let fetchedCustomers = Array.isArray(data?.customers)
                ? data.customers
                : [];

            // PERBAIKAN STEP 1: Filter PO In secara lokal (opsional/fallback)
            // Mengecek apakah properti sisa_qtypr dikirimkan oleh backend untuk header PO IN
            if (
                fetchedCustomers.length > 0 &&
                fetchedCustomers[0].sisa_qtypr !== undefined
            ) {
                fetchedCustomers = fetchedCustomers.filter(
                    (c) => Number(c.sisa_qtypr) > 0,
                );
            }

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
            setMaterialList(
                Array.isArray(data?.materials) ? data.materials : [],
            );
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
        customerSearchTerm,
    ]);

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

            // --- PROSES AUTOFILL MASSAL BERDASARKAN KODE MATERIAL ---
            const itemsWithAutofilledPrice = await Promise.all(
                filteredItems.map(async (item, index) => {
                    let hargaModalTerakhir = item.harga_modal ?? '';

                    // Jika harga_modal dari PO In kosong, mari cari ke tb_invin berdasarkan kd_material
                    if (!hargaModalTerakhir && item.kd_material) {
                        try {
                            const priceRes = await axios.get(
                                '/marketing/purchase-requirement/get-last-price',
                                {
                                    params: { kd_mat: item.kd_material },
                                },
                            );
                            if (priceRes.data && priceRes.data.success) {
                                hargaModalTerakhir = priceRes.data.harga;
                            }
                        } catch (err) {
                            console.error(
                                `Gagal autofill harga untuk ${item.kd_material}:`,
                                err,
                            );
                        }
                    }

                    const stockBreakdown = {
                        stokG1: item.stok_g1 ?? 0,
                        stokG2: item.stok_g2 ?? 0,
                        stokG3: item.stok_g3 ?? 0,
                        stokG4: item.stok_g4 ?? 0,
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
                        qtyPr: totalStock < 0
                            ? Math.min(remainingQtyPr, Math.abs(totalStock))
                            : 0,
                        satuan: item.satuan ?? '',
                        hargaPoIn: item.harga_po_in ?? 0,
                        // Diisi dengan harga modal terakhir dari tb_invin hasil dicocokkan tadi
                        hargaModal: hargaModalTerakhir,
                        margin: calculateMargin(
                            item.harga_po_in ?? 0,
                            hargaModalTerakhir,
                        ),
                        remark: item.remark ?? '',
                        refPo: selectedPoNumber,
                        forCustomer: selectedCustomer,
                    };
                }),
            );
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
                        qtyPr: calculateTotalStock(template) < 0
                            ? Math.min(
                                parseNumber(material.sisa_qtypr),
                                Math.abs(calculateTotalStock(template))
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
        const isFulfilledByStock =
            material &&
            !String(material.id).startsWith('manual-') &&
            parseNumber(material.qtyPr) === 0 &&
            calculateTotalStock(material) >= 0;

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

        const hasInvalidRow = materialItems.some(
            (item) =>
                parseNumber(item.hargaModal) <= 0 ||
                parseNumber(item.qtyPr) < 0 ||
                (item.maxQtyPr !== undefined &&
                    (parseNumber(item.qtyPr) > parseNumber(item.maxQtyPr) ||
                        parseNumber(item.qtyPr) + calculateTotalStock(item) <
                        parseNumber(item.maxQtyPr))),
        );
        if (hasInvalidRow) {
            return 'Harga modal wajib diisi dan Qty PR harus membuat Sisa Qty PR menjadi 0.';
        }

        return '';
    };

    const buildSubmitPayload = () => {
        return {
            date: formData.date,
            payment: formData.payment,
            for_customer: formData.forCustomer,
            ref_po: formData.refPo,
            jenis_pr: selectedPoIns.length > 0 ? 'PR For Customer' : formData.jenisPr,
            stock_fulfilled_detail_ids: stockFulfilledDetailIds,
            materials: materialItems.map((item, index) => ({
                no: index + 1,
                detail_id: String(item.id).startsWith('manual-')
                    ? null
                    : item.id,
                ref_po: item.refPo || formData.refPo,
                for_customer: item.forCustomer || formData.forCustomer,
                kd_material: item.kodeMaterial,
                material: item.namaMaterial,
                qty: item.qtyPr,
                sisa_pr: item.qtyPr,
                poin_consumed_qty:
                    parseNumber(item.maxQtyPr) - Math.max(0, (calculateTotalStock(item) < 0 ? Math.min(parseNumber(item.maxQtyPr), Math.abs(calculateTotalStock(item))) : 0) - parseNumber(item.qtyPr)),
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
            onError: () => setIsSubmitting(false),
            onSuccess: (page) => {
                if (page?.props?.flash?.error) {
                    setIsSubmitting(false);
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
                className="flex h-full flex-1 flex-col gap-4 p-4"
                onSubmit={handleSubmit}
            >
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Tambah PR</h1>
                        <p className="text-sm text-muted-foreground">
                            Isi data PR dalam dua langkah
                        </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                        Step {step} dari 2
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 text-sm">
                    <span
                        className={`rounded-full px-3 py-1 ${step === 1
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                            }`}
                    >
                        1. Data PO Masuk
                    </span>
                    <span
                        className={`rounded-full px-3 py-1 ${step === 2
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                            }`}
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
                                                        if (checked) {
                                                            setSelectedPoIns([]);
                                                            setMaterialItems([]);
                                                        }
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
                            {formData.jenisPr && (
                                <label className="space-y-2 text-sm">
                                    <span className="text-muted-foreground">
                                        Ref PO
                                    </span>
                                    <Input
                                        value={formData.refPo}
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            setFormData((prev) => ({
                                                ...prev,
                                                refPo: value,
                                                forCustomer: value,
                                            }));
                                        }}
                                    />
                                </label>
                            )}
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    {formData.jenisPr
                                        ? 'For Customer'
                                        : 'Pilih PO In'}
                                </span>
                                <div className="flex gap-2">
                                    {formData.jenisPr && (
                                        <Input
                                            value={formData.forCustomer}
                                            readOnly
                                        />
                                    )}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={formData.jenisPr}
                                        onClick={() => {
                                            setIsCustomerModalOpen(true);
                                            setCustomerCurrentPage(1);
                                            setCustomerSearchTerm('');
                                            setCustomerList([]);
                                            setCustomerTotal(0);
                                        }}
                                    >
                                        Cari PO In
                                    </Button>
                                </div>
                            </label>
                            {!formData.jenisPr && selectedPoIns.length > 0 && (
                                <div className="space-y-2 md:col-span-2">
                                    <Label>PO In Terpilih</Label>
                                    <div className="grid gap-2 md:grid-cols-2">
                                        {selectedPoIns.map((po) => (
                                            <div
                                                key={po.kode_poin}
                                                className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold">
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
                                                    title="Hapus PO In"
                                                    onClick={() =>
                                                        removeSelectedPoIn(po)
                                                    }
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
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
                    <div className="mx-auto w-full animate-in space-y-8 duration-500 slide-in-from-right">
                        <div className="grid gap-8 lg:grid-cols-12">
                            {/* Main Entry Section */}
                            <div className="space-y-6 lg:col-span-8">
                                <Card className="border-none shadow-xl ring-1 ring-sidebar-border/70">
                                    <CardHeader className="border-b bg-muted/30">
                                        <CardTitle className="flex items-center gap-2">
                                            <Badge
                                                variant="outline"
                                                className="flex h-6 w-6 items-center justify-center rounded-full p-0"
                                            >
                                                {materialItems.length}
                                            </Badge>
                                            Daftar Material
                                        </CardTitle>
                                        <CardDescription>
                                            Tambahkan material secara manual
                                            atau tarik data dari PO In untuk
                                            mengisi daftar di bawah.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        {/* Material List (Cards) - Always Used */}
                                        <div className="min-h-[300px] space-y-4 p-6">
                                            {materialGroups.length > 1 && (
                                                <div className="rounded-xl border bg-muted/20 p-4">
                                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            disabled={
                                                                activeMaterialGroupIndex ===
                                                                0
                                                            }
                                                            onClick={() =>
                                                                setActiveMaterialGroupIndex(
                                                                    (current) =>
                                                                        Math.max(
                                                                            0,
                                                                            current -
                                                                            1,
                                                                        ),
                                                                )
                                                            }
                                                        >
                                                            Sebelumnya
                                                        </Button>
                                                        <div className="text-center">
                                                            <p className="text-sm font-bold">
                                                                {
                                                                    materialGroups[
                                                                        activeMaterialGroupIndex
                                                                    ]?.refPo
                                                                }
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {materialGroups[
                                                                    activeMaterialGroupIndex
                                                                ]?.customer ||
                                                                    'Material tanpa PO In'}
                                                            </p>
                                                            <p className="mt-1 text-[10px] font-medium text-muted-foreground">
                                                                PO In{' '}
                                                                {activeMaterialGroupIndex +
                                                                    1}{' '}
                                                                dari{' '}
                                                                {
                                                                    materialGroups.length
                                                                }
                                                            </p>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            disabled={
                                                                activeMaterialGroupIndex >=
                                                                materialGroups.length -
                                                                1
                                                            }
                                                            onClick={() =>
                                                                setActiveMaterialGroupIndex(
                                                                    (current) =>
                                                                        Math.min(
                                                                            materialGroups.length -
                                                                            1,
                                                                            current +
                                                                            1,
                                                                        ),
                                                                )
                                                            }
                                                        >
                                                            Berikutnya
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                            {materialItems.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-20 opacity-40">
                                                    <div className="relative mb-4">
                                                        <Search className="h-16 w-16" />
                                                        <Plus className="absolute -top-2 -right-2 h-8 w-8 text-primary" />
                                                    </div>
                                                    <p className="text-xl font-bold tracking-tight uppercase">
                                                        Belum Ada Data
                                                    </p>
                                                    <p className="text-sm">
                                                        Silahkan tambah secara
                                                        manual atau pilih PO In
                                                        di Langkah 1.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="grid gap-4">
                                                    {visibleMaterialItems.map(
                                                        (item, idx) => (
                                                            <div
                                                                key={item.id}
                                                                className="group relative rounded-2xl border border-sidebar-border bg-background p-5 shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-md"
                                                            >
                                                                <div className="absolute top-4 -left-3 flex h-8 w-8 items-center justify-center rounded-lg border border-sidebar-border bg-muted text-[10px] font-black text-muted-foreground transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                                                                    {String(
                                                                        idx + 1,
                                                                    ).padStart(
                                                                        2,
                                                                        '0',
                                                                    )}
                                                                </div>

                                                                <div className="flex flex-col gap-6">
                                                                    {/* Top Section: Info & Delete */}
                                                                    <div className="flex items-start justify-between gap-4">
                                                                        <div className="space-y-1">
                                                                            <h4 className="text-lg leading-tight font-black tracking-tight uppercase transition-colors group-hover:text-primary">
                                                                                {
                                                                                    item.namaMaterial
                                                                                }
                                                                            </h4>
                                                                            <div className="flex flex-wrap gap-2">
                                                                                <Badge
                                                                                    variant="outline"
                                                                                    className="h-5 border-none bg-muted/30 px-1.5 font-mono text-[10px]"
                                                                                >
                                                                                    {
                                                                                        item.kodeMaterial
                                                                                    }
                                                                                </Badge>
                                                                                {item.refPo && (
                                                                                    <Badge className="h-5 px-1.5 text-[10px]">
                                                                                        PO
                                                                                        In:{' '}
                                                                                        {
                                                                                            item.refPo
                                                                                        }
                                                                                    </Badge>
                                                                                )}
                                                                                {item.forCustomer && (
                                                                                    <Badge
                                                                                        variant="secondary"
                                                                                        className="h-5 px-1.5 text-[10px]"
                                                                                    >
                                                                                        {
                                                                                            item.forCustomer
                                                                                        }
                                                                                    </Badge>
                                                                                )}
                                                                                {item.satuan && (
                                                                                    <Badge
                                                                                        variant="outline"
                                                                                        className="h-5 border-none bg-primary/5 px-1.5 text-[10px] hover:bg-primary/10"
                                                                                    >
                                                                                        {
                                                                                            item.satuan
                                                                                        }
                                                                                    </Badge>
                                                                                )}
                                                                                {[
                                                                                    [
                                                                                        'G1',
                                                                                        item.stokG1,
                                                                                    ],
                                                                                    [
                                                                                        'G2',
                                                                                        item.stokG2,
                                                                                    ],
                                                                                    [
                                                                                        'G3',
                                                                                        item.stokG3,
                                                                                    ],
                                                                                    [
                                                                                        'G4',
                                                                                        item.stokG4,
                                                                                    ],
                                                                                    [
                                                                                        'MIB',
                                                                                        item.mib ?? 0,
                                                                                    ],
                                                                                    [
                                                                                        'MIBS',
                                                                                        item.mibs ?? 0,
                                                                                    ],
                                                                                    [
                                                                                        'Qty PR Outstanding',
                                                                                        item.pr_outstanding ?? 0,
                                                                                    ],
                                                                                    [
                                                                                        'Qty PO Outstanding',
                                                                                        item.po_outstanding ?? 0,
                                                                                    ],

                                                                                ].map(
                                                                                    ([
                                                                                        label,
                                                                                        value,
                                                                                    ]) => (
                                                                                        <span
                                                                                            key={
                                                                                                label
                                                                                            }
                                                                                            className="rounded-full border border-blue-100 bg-blue-50 px-2 text-[10px] font-bold text-blue-600"
                                                                                        >
                                                                                            {label.includes('Qty') ? '' : 'Stok '}
                                                                                            {label}: {value ?? 0}
                                                                                        </span>
                                                                                    ),
                                                                                )}
                                                                                <span className="flex items-center gap-1.5 rounded-full border border-orange-100 bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                                                                                    DO Belum Dibuat : {item.do_outstanding ?? 0}
                                                                                </span>
                                                                                <span className="flex items-center gap-1.5 rounded-full border border-green-100 bg-green-50 px-2 text-[10px] font-bold text-green-600">
                                                                                    <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                                                                                    {(item.stok ?? 0) < 0 ? 'Kredit DO:' : 'Total Stok:'}{' '}
                                                                                    {item.stok ??
                                                                                        0}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="group/del h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive"
                                                                            onClick={() =>
                                                                                handleRemoveMaterial(
                                                                                    item.id,
                                                                                )
                                                                            }
                                                                        >
                                                                            <Trash2 className="h-4 w-4 transition-transform group-hover/del:scale-110" />
                                                                        </Button>
                                                                    </div>

                                                                    {/* Middle Section: Inputs */}
                                                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                                        <div className="space-y-2 rounded-xl border border-dashed border-sidebar-border/50 bg-muted/20 p-4">
                                                                            <Label className="text-[10px] font-black tracking-widest text-muted-foreground/70 uppercase">
                                                                                Quantity
                                                                            </Label>
                                                                            <div className="flex items-start justify-between gap-4">
                                                                                <div className="flex min-w-[120px] flex-col gap-3">
                                                                                    <div className="flex flex-col">
                                                                                        <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-50">
                                                                                            Order
                                                                                            In
                                                                                        </span>
                                                                                        <span className="font-mono text-sm font-bold">
                                                                                            {
                                                                                                item.qtyPoIn
                                                                                            }
                                                                                        </span>
                                                                                    </div>
                                                                                    {item.maxQtyPr !==
                                                                                        undefined && (
                                                                                            <>
                                                                                                <div className="flex flex-col">
                                                                                                    <span className="text-[9px] font-bold text-amber-600/70 uppercase">
                                                                                                        Last
                                                                                                        Rem.
                                                                                                        Order
                                                                                                        In
                                                                                                    </span>
                                                                                                    <span className="font-mono text-sm font-bold text-amber-600">
                                                                                                        {
                                                                                                            item.maxQtyPr
                                                                                                        }
                                                                                                    </span>
                                                                                                </div>
                                                                                                <div className="flex flex-col">
                                                                                                    <span className="text-[9px] font-bold text-blue-600/70 uppercase">
                                                                                                        Current
                                                                                                        Rem.
                                                                                                        Order
                                                                                                        In
                                                                                                    </span>
                                                                                                    <span className="font-mono text-sm font-bold text-blue-600">
                                                                                                        {Math.max(
                                                                                                            0,
                                                                                                            (calculateTotalStock(item) < 0 ? Math.min(parseNumber(item.maxQtyPr), Math.abs(calculateTotalStock(item))) : 0) - parseNumber(item.qtyPr)
                                                                                                        )}
                                                                                                    </span>
                                                                                                </div>
                                                                                            </>
                                                                                        )}
                                                                                </div>
                                                                                <div className="h-10 w-[1px] bg-sidebar-border opacity-50" />
                                                                                <div className="flex flex-1 flex-col items-end">
                                                                                    <span className="mb-1 text-[9px] font-bold text-primary uppercase">
                                                                                        PR
                                                                                        Input
                                                                                    </span>
                                                                                    <div className="relative w-full">
                                                                                        <Input
                                                                                            type="number"
                                                                                            min="0"
                                                                                            max={
                                                                                                calculateTotalStock(item) < 0 ? Math.min(parseNumber(item.maxQtyPr), Math.abs(calculateTotalStock(item))) : 0
                                                                                            }
                                                                                            className={cn(
                                                                                                'h-10 w-full bg-background text-right text-lg font-black shadow-xs ring-offset-0 focus-visible:ring-2',
                                                                                                item.maxQtyPr !== undefined &&
                                                                                                (parseNumber(item.qtyPr) > (calculateTotalStock(item) < 0 ? Math.min(parseNumber(item.maxQtyPr), Math.abs(calculateTotalStock(item))) : 0)
                                                                                                    ? 'border-destructive focus-visible:ring-destructive'
                                                                                                    : 'border-primary/20 focus-visible:ring-primary')
                                                                                            )}
                                                                                            value={
                                                                                                item.qtyPr
                                                                                            }
                                                                                            onChange={(
                                                                                                e,
                                                                                            ) =>
                                                                                                handleQtyPrChange(
                                                                                                    item.id,
                                                                                                    e
                                                                                                        .target
                                                                                                        .value,
                                                                                                )
                                                                                            }
                                                                                        />
                                                                                    </div>
                                                                                    {item.maxQtyPr !==
                                                                                        undefined &&
                                                                                        parseNumber(
                                                                                            item.qtyPr,
                                                                                        ) >
                                                                                        (calculateTotalStock(item) < 0 ? Math.min(parseNumber(item.maxQtyPr), Math.abs(calculateTotalStock(item))) : 0) && (
                                                                                            <p className="mt-1 text-right text-xs font-medium text-destructive">
                                                                                                Qty
                                                                                                PR
                                                                                                tidak
                                                                                                boleh
                                                                                                melebihi
                                                                                                Qty
                                                                                                Sisa
                                                                                                PR
                                                                                                (
                                                                                                {renderValue(
                                                                                                    calculateTotalStock(item) < 0 ? Math.min(parseNumber(item.maxQtyPr), Math.abs(calculateTotalStock(item))) : 0,
                                                                                                )}
                                                                                                ).
                                                                                            </p>
                                                                                        )}
                                                                                    {parseNumber(item.qtyPr) === 0 && !String(item.id).startsWith('manual-') && (
                                                                                        <p className="mt-1 text-right text-[10px] font-medium text-amber-600 leading-tight">
                                                                                            PR input tidak boleh 0. Jika stock memenuhi maka Langsung realisasikan dengan cara klik icon trash di material.
                                                                                        </p>
                                                                                    )}
                                                                                </div>

                                                                            </div>
                                                                        </div>

                                                                        <div className="space-y-2 rounded-xl border border-dashed border-sidebar-border/50 bg-muted/20 p-4">
                                                                            <Label className="text-[10px] font-black tracking-widest text-muted-foreground/70 uppercase">
                                                                                Harga
                                                                                (IDR)
                                                                            </Label>
                                                                            <div className="flex items-start justify-between gap-4">
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-[9px] font-bold tracking-tighter text-muted-foreground uppercase opacity-50">
                                                                                        PO
                                                                                        IN
                                                                                    </span>
                                                                                    <span className="font-mono text-xs font-bold">
                                                                                        {formatRupiah(
                                                                                            item.hargaPoIn,
                                                                                        )}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="h-10 w-[1px] bg-sidebar-border opacity-50" />
                                                                                <div className="flex flex-1 flex-col items-end">
                                                                                    <span className="mb-1 text-[9px] font-bold tracking-tighter text-primary uppercase italic">
                                                                                        Modal
                                                                                        Est.
                                                                                    </span>
                                                                                    <div className="relative w-full">
                                                                                        <Input
                                                                                            type="text"
                                                                                            className="h-10 w-full border-primary/20 bg-background pl-8 text-right text-lg font-black shadow-xs ring-offset-0 focus-visible:ring-2 focus-visible:ring-primary"
                                                                                            value={formatRupiah(
                                                                                                item.hargaModal,
                                                                                            )}
                                                                                            onChange={(
                                                                                                e,
                                                                                            ) =>
                                                                                                handleHargaModalChange(
                                                                                                    item.id,
                                                                                                    parseRupiahInput(
                                                                                                        e
                                                                                                            .target
                                                                                                            .value,
                                                                                                    ),
                                                                                                )
                                                                                            }
                                                                                        />
                                                                                        <span className="absolute top-3 left-2.5 text-[10px] font-black opacity-30">
                                                                                            RP
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Bottom Section: Total & Margin */}
                                                                    <div className="group/total flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/10 bg-primary/5 p-6">
                                                                        <div className="flex flex-col">
                                                                            <div className="mb-1 text-[10px] font-black tracking-widest text-primary/60 uppercase">
                                                                                Estimated
                                                                                Total
                                                                                Sum
                                                                            </div>
                                                                            <div className="text-3xl font-black tracking-tighter text-primary transition-transform group-active:scale-95">
                                                                                {formatRupiah(
                                                                                    calculateTotalPrice(
                                                                                        item.qtyPr,
                                                                                        item.hargaModal,
                                                                                    ),
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        {item.margin !==
                                                                            '' && (
                                                                                <div className="flex flex-col items-end gap-2">
                                                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">
                                                                                        Profit
                                                                                        Margin
                                                                                    </span>
                                                                                    <Badge
                                                                                        variant={
                                                                                            parseNumber(
                                                                                                item.margin,
                                                                                            ) <
                                                                                                0
                                                                                                ? 'destructive'
                                                                                                : 'outline'
                                                                                        }
                                                                                        className={cn(
                                                                                            'h-8 border-none px-3 font-mono text-sm shadow-sm',
                                                                                            parseNumber(
                                                                                                item.margin,
                                                                                            ) >=
                                                                                                0
                                                                                                ? 'bg-green-500 text-white'
                                                                                                : 'bg-destructive text-white',
                                                                                        )}
                                                                                    >
                                                                                        {formatMargin(
                                                                                            item.margin,
                                                                                        )}

                                                                                        %
                                                                                    </Badge>
                                                                                </div>
                                                                            )}
                                                                    </div>
                                                                </div>

                                                                {/* Remark: Full Width Bottom */}
                                                                <div className="mt-4 border-t border-dashed border-sidebar-border/50 pt-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="rounded-full bg-muted p-1.5">
                                                                            <Plus className="h-3 w-3 rotate-45 text-muted-foreground" />
                                                                        </div>
                                                                        <Input
                                                                            type="text"
                                                                            placeholder="Tulis catatan atau instruksi khusus untuk barang ini..."
                                                                            className="h-8 border-none bg-transparent px-0 text-xs italic shadow-none hover:bg-muted/30 focus:bg-background"
                                                                            value={
                                                                                item.remark
                                                                            }
                                                                            onChange={(
                                                                                e,
                                                                            ) =>
                                                                                handleRemarkChange(
                                                                                    item.id,
                                                                                    e
                                                                                        .target
                                                                                        .value,
                                                                                )
                                                                            }
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {formData.jenisPr && (
                                            <div className="border-t bg-primary/5 p-6 dark:bg-primary/10">
                                                <h3 className="mb-4 text-sm font-bold tracking-widest text-primary uppercase">
                                                    Input Material Baru
                                                </h3>
                                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                                                    <div className="space-y-2 md:col-span-2 xl:col-span-5">
                                                        <Label className="text-xs">
                                                            Material
                                                        </Label>
                                                        <div className="flex gap-2">
                                                            <div className="relative flex-1">
                                                                <Input
                                                                    placeholder="Pilih Material..."
                                                                    className="h-10 border-primary/20 bg-background pr-10"
                                                                    value={
                                                                        materialForm.namaMaterial
                                                                    }
                                                                    readOnly
                                                                />
                                                                {materialForm.kodeMaterial && (
                                                                    <div className="absolute top-2.5 right-3">
                                                                        <Check className="h-5 w-5 text-green-500" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                className="h-10"
                                                                onClick={() =>
                                                                    setIsMaterialModalOpen(
                                                                        true,
                                                                    )
                                                                }
                                                            >
                                                                <Search className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                        {materialForm.kodeMaterial && (
                                                            <p className="font-mono text-[14px] text-muted-foreground">
                                                                KODE MATERIAL:{' '}
                                                                {
                                                                    materialForm.kodeMaterial
                                                                }
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="space-y-2 xl:col-span-1">
                                                        <Label className="text-xs">
                                                            {parseFloat(materialForm.lastStock) < 0 ? 'Kredit DO' : 'Total Stok'}
                                                        </Label>
                                                        <Input
                                                            type="text"
                                                            className="h-10 bg-muted/50 font-bold"
                                                            value={
                                                                materialForm.lastStock
                                                            }
                                                            readOnly
                                                        />
                                                    </div>
                                                    <div className="space-y-2 xl:col-span-2">
                                                        <Label className="text-xs">
                                                            Quantity
                                                        </Label>
                                                        <Input
                                                            type="number"
                                                            className="h-10 border-primary/20"
                                                            placeholder="0"
                                                            value={
                                                                materialForm.quantity
                                                            }
                                                            onChange={(e) =>
                                                                updateMaterialForm(
                                                                    'quantity',
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                    <div className="space-y-2 xl:col-span-2">
                                                        <Label className="text-xs">
                                                            Harga Est.
                                                        </Label>
                                                        <Input
                                                            type="text"
                                                            className="h-10 border-primary/20"
                                                            placeholder="Rp 0"
                                                            value={formatRupiah(
                                                                materialForm.priceEstimate,
                                                            )}
                                                            onChange={(e) =>
                                                                updateMaterialForm(
                                                                    'priceEstimate',
                                                                    parseRupiahInput(
                                                                        e.target
                                                                            .value,
                                                                    ),
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                    <div className="space-y-2 md:col-span-2 xl:col-span-5">
                                                        <Label className="text-xs">
                                                            Remark / Catatan
                                                        </Label>
                                                        <Input
                                                            type="text"
                                                            className="h-10 border-primary/20"
                                                            placeholder="Tambahkan catatan untuk material ini..."
                                                            value={
                                                                materialForm.remark
                                                            }
                                                            onChange={(e) =>
                                                                updateMaterialForm(
                                                                    'remark',
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                                <div className="mt-4 flex items-center justify-between border-t border-primary/10 pt-4">
                                                    <div className="text-xl">
                                                        <span className="text-muted-foreground italic">
                                                            Total Item:{' '}
                                                        </span>
                                                        <span className="font-bold text-primary">
                                                            {formatRupiah(
                                                                materialForm.totalPrice,
                                                            )}
                                                        </span>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        onClick={
                                                            handleAddManualMaterial
                                                        }
                                                        disabled={
                                                            !materialForm.kodeMaterial
                                                        }
                                                        className="h-10 px-6 shadow-lg shadow-primary/20"
                                                    >
                                                        <Plus className="mr-2 h-4 w-4" />{' '}
                                                        Tambah Ke Daftar
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Summary Section */}
                            <div className="space-y-6 lg:col-span-4">
                                <Card className="sticky top-24 overflow-hidden border-none shadow-2xl ring-2 ring-primary/5">
                                    <div className="h-2 bg-primary" />
                                    <CardHeader className="bg-muted/10 pb-4">
                                        <CardTitle className="text-base tracking-wider text-muted-foreground uppercase">
                                            Summary PR
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-6 p-6">
                                        <div className="space-y-3 border-b pb-6 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">
                                                    Ref No:
                                                </span>
                                                <Badge
                                                    variant="secondary"
                                                    className="font-mono"
                                                >
                                                    {formData.refPo || '-'}
                                                </Badge>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">
                                                    Customer:
                                                </span>
                                                <span
                                                    className="max-w-[150px] truncate text-right font-bold"
                                                    title={formData.forCustomer}
                                                >
                                                    {formData.forCustomer ||
                                                        '-'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">
                                                    Metode:
                                                </span>
                                                <Badge variant="outline">
                                                    {formData.payment}
                                                </Badge>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground">
                                                    Subtotal (
                                                    {materialItems.length}{' '}
                                                    items)
                                                </span>
                                                <span className="text-lg font-bold">
                                                    {formatRupiah(
                                                        materialItems.reduce(
                                                            (acc, item) =>
                                                                acc +
                                                                parseNumber(
                                                                    calculateTotalPrice(
                                                                        item.qtyPr,
                                                                        item.hargaModal,
                                                                    ),
                                                                ),
                                                            0,
                                                        ),
                                                    )}
                                                </span>
                                            </div>
                                            <div className="rounded-xl bg-primary/5 p-4 text-center">
                                                <p className="mb-1 text-[10px] font-bold tracking-widest text-primary uppercase">
                                                    Total Estimasi
                                                </p>
                                                <h4 className="text-2xl font-black text-primary">
                                                    {formatRupiah(
                                                        materialItems.reduce(
                                                            (acc, item) =>
                                                                acc +
                                                                parseNumber(
                                                                    calculateTotalPrice(
                                                                        item.qtyPr,
                                                                        item.hargaModal,
                                                                    ),
                                                                ),
                                                            0,
                                                        ),
                                                    )}
                                                </h4>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-4">
                                            <Button
                                                variant="outline"
                                                type="button"
                                                className="h-12 w-full"
                                                onClick={() => setStep(1)}
                                            >
                                                <ArrowLeft className="mr-2 h-4 w-4" />{' '}
                                                Kembali
                                            </Button>
                                            <Button
                                                type="submit"
                                                className="h-12 w-full shadow-xl shadow-primary/20"
                                                disabled={
                                                    isSubmitting ||
                                                    materialItems.length === 0
                                                }
                                            >
                                                {isSubmitting ? (
                                                    <Spinner />
                                                ) : (
                                                    <>
                                                        <Check className="mr-2 h-5 w-5" />{' '}
                                                        Simpan
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                        {submitError && (
                                            <div className="mt-4 animate-bounce rounded-lg bg-destructive/10 p-3 text-center text-xs font-medium text-destructive">
                                                {submitError}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                )}

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
                    <DialogContent
                        aria-describedby={undefined}
                        className="!top-0 !left-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-y-auto !rounded-none"
                    >
                        <DialogHeader>
                            <DialogTitle>Pilih PO In</DialogTitle>
                        </DialogHeader>
                        <DialogDescription className="sr-only">
                            Pilih PO In untuk mengisi Ref PO, customer, dan
                            detail material.
                        </DialogDescription>

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
                                    placeholder="Cari kode PO In, no PO In, customer..."
                                    value={customerSearchTerm}
                                    onChange={(event) => {
                                        setCustomerSearchTerm(
                                            event.target.value,
                                        );
                                        setCustomerCurrentPage(1);
                                    }}
                                />
                            </label>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={loadCustomers}
                            >
                                Refresh
                            </Button>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 text-left">
                                            Kode PO In
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            No PO In
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Date
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Customer
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {customerList.length === 0 && (
                                        <tr>
                                            <td
                                                className="px-4 py-6 text-center text-muted-foreground"
                                                colSpan={5}
                                            >
                                                {customerLoading
                                                    ? 'Memuat data PO In...'
                                                    : customerError ||
                                                    'Tidak ada data PO In.'}
                                            </td>
                                        </tr>
                                    )}
                                    {customerList.map((item) => (
                                        <tr
                                            key={`${item.kode_poin}-${item.no_poin}`}
                                            className="border-t border-sidebar-border/70"
                                        >
                                            <td className="px-4 py-3">
                                                {renderValue(item.kode_poin)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {renderValue(item.no_poin)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {renderValue(item.date_poin)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {renderValue(
                                                    item.customer_name,
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setHasConfirmedOverdue(
                                                            false,
                                                        );
                                                        setOverdueWarningData(
                                                            null,
                                                        );
                                                        setFormData((prev) => ({
                                                            ...prev,
                                                            refPo: prev.jenisPr
                                                                ? forValue
                                                                : (item.no_poin ??
                                                                    ''),
                                                            forCustomer:
                                                                prev.jenisPr
                                                                    ? forValue
                                                                    : (item.customer_name ??
                                                                        ''),
                                                        }));
                                                        setSelectedPoIns([
                                                            {
                                                                kode_poin:
                                                                    item.kode_poin,
                                                                no_poin:
                                                                    item.no_poin,
                                                                customer_name:
                                                                    item.customer_name,
                                                            },
                                                        ]);
                                                        setIsCustomerModalOpen(
                                                            false,
                                                        );
                                                        loadPoInMaterials(
                                                            item.kode_poin ??
                                                            '',
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
                                            customerCurrentPage >=
                                            customerTotalPages
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
                    open={isMatchingPoModalOpen}
                    onOpenChange={setIsMatchingPoModalOpen}
                >
                    <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>
                                PO In dengan material yang sama
                            </DialogTitle>
                            <DialogDescription>
                                Pilih PO In tambahan. Quantity setiap PO In akan
                                disimpan pada baris terpisah.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                            {matchingPoIns.map((po) => (
                                <label
                                    key={po.kode_poin}
                                    className="block cursor-pointer rounded-lg border p-4"
                                >
                                    <div className="mb-3 flex items-center gap-3">
                                        <Checkbox
                                            checked={selectedMatchingPoIns.includes(
                                                po.kode_poin,
                                            )}
                                            onCheckedChange={(checked) =>
                                                setSelectedMatchingPoIns(
                                                    (current) =>
                                                        checked
                                                            ? [
                                                                ...new Set([
                                                                    ...current,
                                                                    po.kode_poin,
                                                                ]),
                                                            ]
                                                            : current.filter(
                                                                (value) =>
                                                                    value !==
                                                                    po.kode_poin,
                                                            ),
                                                )
                                            }
                                        />
                                        <span className="font-semibold">
                                            {renderValue(po.no_poin)} —{' '}
                                            {renderValue(po.customer_name)}
                                        </span>
                                    </div>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Material</TableHead>
                                                <TableHead>Qty</TableHead>
                                                <TableHead>
                                                    Sisa Qty PR
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(po.materials ?? []).map(
                                                (material) => (
                                                    <TableRow key={material.id}>
                                                        <TableCell>
                                                            {renderValue(
                                                                material.material,
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {renderValue(
                                                                material.qty,
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {renderValue(
                                                                material.sisa_qtypr,
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ),
                                            )}
                                        </TableBody>
                                    </Table>
                                </label>
                            ))}
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsMatchingPoModalOpen(false)}
                            >
                                Lewati
                            </Button>
                            <Button
                                type="button"
                                disabled={selectedMatchingPoIns.length === 0}
                                onClick={addSelectedMatchingPoIns}
                            >
                                Tambahkan PO In
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
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
                                            <TableHead className="text-right">
                                                Stok
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
                                                    <TableCell className="font-mono text-xs">
                                                        {m.kd_material}
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        {m.material}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground uppercase">
                                                        {m.unit}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {m.stok}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            size="sm"
                                                            variant="default"
                                                            className="h-8"
                                                            onClick={async () => {
                                                                let priceEstimate =
                                                                    m.harga ||
                                                                    0;

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
                                                                    const latestPrice =
                                                                        parseNumber(
                                                                            priceRes
                                                                                .data
                                                                                ?.harga,
                                                                        );
                                                                    if (
                                                                        priceRes
                                                                            .data
                                                                            ?.success &&
                                                                        latestPrice >
                                                                        0
                                                                    ) {
                                                                        priceEstimate =
                                                                            latestPrice;
                                                                    }
                                                                } catch {
                                                                    priceEstimate =
                                                                        m.harga ||
                                                                        0;
                                                                }

                                                                setMaterialForm(
                                                                    (prev) => {
                                                                        const stockBreakdown =
                                                                        {
                                                                            stokG1:
                                                                                m.stok_g1 ??
                                                                                0,
                                                                            stokG2:
                                                                                m.stok_g2 ??
                                                                                0,
                                                                            stokG3:
                                                                                m.stok_g3 ??
                                                                                0,
                                                                            stokG4:
                                                                                m.stok_g4 ??
                                                                                0,
                                                                            mib: m.mib ?? 0,
                                                                            mibs: m.mibs ?? 0,
                                                                            pr_outstanding: m.pr_outstanding ?? 0,
                                                                            po_outstanding: m.po_outstanding ?? 0,
                                                                            do_outstanding: m.do_outstanding ?? 0,
                                                                        };

                                                                        return {
                                                                            ...prev,
                                                                            kodeMaterial:
                                                                                m.kd_material,
                                                                            namaMaterial:
                                                                                m.material,
                                                                            satuan: m.unit,
                                                                            ...stockBreakdown,
                                                                            lastStock:
                                                                                calculateTotalStock(
                                                                                    stockBreakdown,
                                                                                ),
                                                                            priceEstimate,
                                                                            totalPrice:
                                                                                parseNumber(
                                                                                    prev.quantity,
                                                                                ) *
                                                                                parseNumber(
                                                                                    priceEstimate,
                                                                                ),
                                                                        };
                                                                    },
                                                                );
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

            <Dialog
                open={isDeleteConfirmOpen}
                onOpenChange={setIsDeleteConfirmOpen}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Konfirmasi Penghapusan</DialogTitle>
                        <DialogDescription>
                            Stok sudah memenuhi kebutuhan material ini. Apakah
                            Anda yakin ingin menghapus material? Sisa Qty PO
                            Masuk akan diubah menjadi 0 saat PR disimpan.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsDeleteConfirmOpen(false)}
                            disabled={isDeletingMaterial}
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={confirmDeleteMaterial}
                            disabled={isDeletingMaterial}
                        >
                            {isDeletingMaterial ? 'Menghapus...' : 'Ya, Hapus'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

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
