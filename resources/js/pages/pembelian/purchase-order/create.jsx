import { PlainTableStateRows } from '@/components/data-states/TableStateRows';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { normalizeApiError, readApiError } from '@/lib/api-error';
import { Head, router } from '@inertiajs/react';
import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Purchase Order', href: '/pembelian/purchase-order' },
    { title: 'Tambah PO', href: '/pembelian/purchase-order/create' },
];

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const withRequiredSpace = (value) => {
    const normalized = String(value ?? '');
    return normalized.trim() === '' ? ' ' : normalized;
};

const parseNumber = (value) => {
    const normalized = String(value ?? '')
        .replace(/,/g, '')
        .trim();
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const formatInteger = (value) =>
    new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(
        Math.trunc(parseNumber(value)),
    );

const hasOverdueMoreThan90Days = (item) =>
    Boolean(item?.has_overdue_gt_90) ||
    parseNumber(item?.oldest_overdue_days) > 90;

const getPrCustomers = (item) =>
    Array.isArray(item?.customers) && item.customers.length > 0
        ? item.customers
        : [item];

const getPrCustomerKey = (customer = {}) =>
    `${String(customer.for_customer ?? '').trim()}||${String(customer.ref_po ?? '').trim()}`;

const groupSelectedPrMaterials = (items = []) => {
    const grouped = new Map();

    items.forEach((item) => {
        const key = [
            String(item.no_pr ?? '').trim(),
            String(item.kd_material ?? '').trim(),
            String(item.material ?? '').trim(),
            String(item.unit ?? '').trim(),
            String(item.renmark ?? '').trim(),
        ].join('||');
        const qty = parseNumber(item.qty);
        const sisaQty = parseNumber(item.sisa_pr ?? item.Sisa_pr);
        const customerKey = getPrCustomerKey(item);

        if (!grouped.has(key)) {
            grouped.set(key, {
                id: key,
                no_pr: item.no_pr ?? '',
                kd_material: item.kd_material ?? '',
                material: item.material ?? '',
                unit: item.unit ?? '',
                renmark: item.renmark ?? '',
                qty: 0,
                sisa_pr: 0,
                sourceLines: [],
            });
        }

        const entry = grouped.get(key);
        entry.qty += qty;
        entry.sisa_pr += sisaQty;
        entry.sourceLines.push({
            no_pr: item.no_pr ?? '',
            kd_material: item.kd_material ?? '',
            for_customer: item.for_customer ?? '',
            ref_po: item.ref_po ?? '',
            qty: qty,
            sisa_pr: sisaQty,
            available_qty: sisaQty,
            source_key: customerKey,
        });
    });

    return Array.from(grouped.values());
};

const formatRupiah = (value) => {
    const number = Number(value);
    if (Number.isNaN(number)) {
        return 'Rp. 0';
    }
    return `Rp. ${new Intl.NumberFormat('id-ID').format(number)}`;
};

const todayValue = () => {
    const date = new Date();
    return date.toISOString().slice(0, 10);
};

export default function PurchaseOrderCreate({
    purchaseRequirements = [],
    purchaseRequirementDetails = [],
    vendors = [],
}) {
    const [step, setStep] = useState(1);
    const [isPrModalOpen, setIsPrModalOpen] = useState(false);
    const [blockedPr, setBlockedPr] = useState(null);
    const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [prList, setPrList] = useState(purchaseRequirements);
    const [prDetailList, setPrDetailList] = useState(
        purchaseRequirementDetails,
    );
    const [vendorList, setVendorList] = useState(vendors);
    const [prLoading, setPrLoading] = useState(false);
    const [prError, setPrError] = useState(null);
    const [prDetailLoading, setPrDetailLoading] = useState(false);
    const [prDetailError, setPrDetailError] = useState(null);
    const [vendorLoading, setVendorLoading] = useState(false);
    const [vendorError, setVendorError] = useState(null);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [pendingSubmitPayload, setPendingSubmitPayload] = useState(null);
    const [returnAllocations, setReturnAllocations] = useState({});

    const [prSearchTerm, setPrSearchTerm] = useState('');
    const [prPageSize, setPrPageSize] = useState(5);
    const [prCurrentPage, setPrCurrentPage] = useState(1);

    const [vendorSearchTerm, setVendorSearchTerm] = useState('');
    const [vendorPageSize, setVendorPageSize] = useState(5);
    const [vendorCurrentPage, setVendorCurrentPage] = useState(1);

    const [formData, setFormData] = useState({
        date: todayValue(),
        refPr: '',
        forCustomer: '',
        refPoMasuk: '',
        refQuota: '',
        selectedCustomers: [],
        kodeVendor: '',
        namaVendor: '',
        attended: '',
        ppn: '',
        paymentTerms: '',
        deliveryTime: 'SEGERA',
        francoLoco: '',
        note1: '',
        note2: '',
        note3: '',
        note4: '',
    });

    const [materialForm, setMaterialForm] = useState({
        kodeMaterial: '',
        material: '',
        qty: '',
        sisaQty: '',
        satuan: '',
        basePrice: '',
        remark: '',
        forCustomer: '',
        refPo: '',
        prGroupKey: '',
        prSources: [],
    });

    const [includePpn, setIncludePpn] = useState(false);
    const [materialItems, setMaterialItems] = useState([]);

    const filteredPr = useMemo(() => {
        const term = prSearchTerm.trim().toLowerCase();
        let items = prList;

        if (term) {
            items = prList.filter((item) => {
                const values = [
                    item.no_pr,
                    ...getPrCustomers(item).flatMap((customer) => [
                        customer.ref_po,
                        customer.for_customer,
                    ]),
                ];
                return values.some((value) =>
                    String(value ?? '')
                        .toLowerCase()
                        .includes(term),
                );
            });
        }

        return [...items].sort((a, b) =>
            String(b.no_pr ?? '').localeCompare(String(a.no_pr ?? '')),
        );
    }, [prSearchTerm, prList]);

    const prTotalItems = filteredPr.length;
    const prTotalPages = useMemo(() => {
        if (prPageSize === Infinity) {
            return 1;
        }
        return Math.max(1, Math.ceil(prTotalItems / prPageSize));
    }, [prPageSize, prTotalItems]);

    const displayedPr = useMemo(() => {
        if (prPageSize === Infinity) {
            return filteredPr;
        }

        const startIndex = (prCurrentPage - 1) * prPageSize;
        return filteredPr.slice(startIndex, startIndex + prPageSize);
    }, [filteredPr, prCurrentPage, prPageSize]);

    const filteredVendors = useMemo(() => {
        const term = vendorSearchTerm.trim().toLowerCase();
        if (!term) {
            return vendorList;
        }

        return vendorList.filter((item) =>
            String(item.nm_vdr ?? '')
                .toLowerCase()
                .includes(term),
        );
    }, [vendorSearchTerm, vendorList]);

    const vendorTotalItems = filteredVendors.length;
    const vendorTotalPages = useMemo(() => {
        if (vendorPageSize === Infinity) {
            return 1;
        }
        return Math.max(1, Math.ceil(vendorTotalItems / vendorPageSize));
    }, [vendorPageSize, vendorTotalItems]);

    const displayedVendors = useMemo(() => {
        if (vendorPageSize === Infinity) {
            return filteredVendors;
        }
        const startIndex = (vendorCurrentPage - 1) * vendorPageSize;
        return filteredVendors.slice(startIndex, startIndex + vendorPageSize);
    }, [filteredVendors, vendorCurrentPage, vendorPageSize]);

    const selectedPrMaterials = useMemo(() => {
        if (!formData.refPr) {
            return [];
        }

        const selectedNoPr = String(formData.refPr ?? '').trim();
        return prDetailList.filter(
            (detail) =>
                String(detail.no_pr ?? '').trim() === selectedNoPr &&
                parseNumber(detail.sisa_pr ?? detail.Sisa_pr) > 0,
        );
    }, [formData.refPr, prDetailList]);

    const groupedPrMaterials = useMemo(
        () => groupSelectedPrMaterials(selectedPrMaterials),
        [selectedPrMaterials],
    );

    const basePriceValue = parseNumber(materialForm.basePrice);
    const qtyValue = parseNumber(materialForm.qty);
    const sisaQtyValue = parseNumber(materialForm.sisaQty);
    const appliedPpn = includePpn ? parseNumber(formData.ppn) : 0;
    const divisor = includePpn ? 1 + appliedPpn / 100 : 1;
    const netPrice = divisor ? basePriceValue / divisor : basePriceValue;
    const ppnValue = includePpn ? basePriceValue - netPrice : 0;
    const priceWithPpn = includePpn ? netPrice : basePriceValue;
    const totalPriceValue = qtyValue * (includePpn ? basePriceValue : netPrice);
    const isQtyExceedsSisa = materialForm.qty !== '' && qtyValue > sisaQtyValue;
    const canAddMaterial =
        !!materialForm.kodeMaterial &&
        qtyValue > 0 &&
        !isQtyExceedsSisa &&
        basePriceValue > 0;

    const applyPrSelection = (item) => {
        const eligibleCustomers = getPrCustomers(item).filter(
            (customer) => !hasOverdueMoreThan90Days(customer),
        );

        if (eligibleCustomers.length === 0) return;

        setFormData((prev) => ({
            ...prev,
            refPr: item.no_pr ?? '',
            forCustomer: eligibleCustomers
                .map((customer) => customer.for_customer)
                .join(', '),
            refPoMasuk: eligibleCustomers
                .map((customer) => customer.ref_po)
                .join(', '),
            refQuota: item.ref_quota ?? '',
            selectedCustomers: eligibleCustomers,
        }));
        setIsPrModalOpen(false);
    };

    const handlePrSelect = (item) => {
        const blockedCustomers = getPrCustomers(item).filter(
            hasOverdueMoreThan90Days,
        );
        if (blockedCustomers.length > 0) {
            setBlockedPr(item);
            return;
        }
        applyPrSelection(item);
    };

    const handleVendorSelect = async (item) => {
        const vendorCode = item.kd_vdr ?? '';
        const vendorName = item.nm_vdr ?? '';

        // Immediate frontend generation for Ref Quota
        const stopWords = [
            'PT',
            'CV',
            'UD',
            'TOKO',
            'BENGKEL',
            'LAS',
            'PD',
            'TB',
            'FA',
        ];
        const words = vendorName.replace(/[^A-Za-z0-9 ]/g, '').split(' ');
        const filteredWords = words.filter(
            (w) => w.length > 0 && !stopWords.includes(w.toUpperCase()),
        );
        const sourceWords = filteredWords.length > 0 ? filteredWords : words;
        const acronym = sourceWords
            .map((w) => w[0])
            .join('')
            .toUpperCase();
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yy = String(now.getFullYear()).slice(-2);
        const datePart = `${dd}${mm}${yy}`;
        const immediateRefQuota = acronym ? `${acronym}-${datePart}` : '';

        // Set initial vendor info and immediate ref_quota
        setFormData((prev) => ({
            ...prev,
            kodeVendor: vendorCode,
            namaVendor: vendorName,
            attended: item.attn_vdr ?? prev.attended,
            refQuota: immediateRefQuota || prev.refQuota,
        }));

        setIsVendorModalOpen(false);

        try {
            const query = new URLSearchParams({
                kd_vdr: vendorCode,
                nm_vdr: vendorName,
            }).toString();

            const response = await fetch(
                `/pembelian/purchase-order/suggest-vendor?${query}`,
                {
                    headers: {
                        Accept: 'application/json',
                    },
                },
            );

            if (response.ok) {
                const suggestion = await response.json();
                setFormData((prev) => ({
                    ...prev,
                    ppn: suggestion.ppn ?? prev.ppn,
                    paymentTerms: suggestion.payment_terms ?? prev.paymentTerms,
                    deliveryTime: suggestion.delivery_time ?? prev.deliveryTime,
                    francoLoco: suggestion.franco_loco ?? prev.francoLoco,
                    refQuota: suggestion.ref_quota ?? prev.refQuota,
                }));
            }
        } catch (error) {
            console.error('Failed to fetch vendor suggestions:', error);
        }
    };

    const loadPrs = async () => {
        if (prLoading || prList.length > 0) {
            return;
        }
        setPrLoading(true);
        setPrError(null);
        try {
            const response = await fetch(
                '/pembelian/purchase-order/outstanding-pr',
                {
                    headers: { Accept: 'application/json' },
                },
            );
            if (!response.ok) {
                throw await readApiError(response);
            }
            const data = await response.json();
            setPrList(
                Array.isArray(data?.purchaseRequirements)
                    ? data.purchaseRequirements
                    : [],
            );
        } catch (error) {
            setPrError(normalizeApiError(error, 'Gagal memuat data PR.'));
        } finally {
            setPrLoading(false);
        }
    };

    const loadPrDetails = async (noPr, selections) => {
        if (!noPr) {
            return;
        }
        setPrDetailLoading(true);
        setPrDetailError(null);
        try {
            const response = await fetch(
                `/pembelian/purchase-order/pr-details?${new URLSearchParams({
                    no_pr: noPr,
                    selections: JSON.stringify(selections ?? []),
                }).toString()}`,
                { headers: { Accept: 'application/json' } },
            );
            if (!response.ok) {
                throw await readApiError(response);
            }
            const data = await response.json();
            setPrDetailList(
                Array.isArray(data?.purchaseRequirementDetails)
                    ? data.purchaseRequirementDetails
                    : [],
            );
            // --- TANGKAP HASIL AI DAN MASUKKAN KE NOTE 1 ---
            if (data.autofill_note_1) {
                setFormData((prev) => ({
                    ...prev,
                    note1: data.autofill_note_1,
                }));
            }
            // -----------------------------------------------
        } catch (error) {
            setPrDetailError(
                normalizeApiError(error, 'Gagal memuat detail PR.'),
            );
        } finally {
            setPrDetailLoading(false);
        }
    };

    const loadVendors = async () => {
        if (vendorLoading || vendorList.length > 0) {
            return;
        }
        setVendorLoading(true);
        setVendorError(null);
        try {
            const response = await fetch('/pembelian/purchase-order/vendors', {
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) {
                throw await readApiError(response);
            }
            const data = await response.json();
            setVendorList(Array.isArray(data?.vendors) ? data.vendors : []);
        } catch (error) {
            setVendorError(
                normalizeApiError(error, 'Gagal memuat data vendor.'),
            );
        } finally {
            setVendorLoading(false);
        }
    };

    const handleMaterialSelect = (item) => {
        const sisaQty = item.sisa_pr ?? item.Sisa_pr;
        const sourceLines = Array.isArray(item.sourceLines)
            ? item.sourceLines
            : [];
        setMaterialForm((prev) => ({
            ...prev,
            kodeMaterial: item.kd_material ?? '',
            material: item.material ?? '',
            qty:
                sisaQty === null || sisaQty === undefined
                    ? ''
                    : String(Math.trunc(parseNumber(sisaQty))),
            sisaQty:
                sisaQty === null || sisaQty === undefined
                    ? ''
                    : String(Math.trunc(parseNumber(sisaQty))),
            satuan: item.unit ?? '',
            remark: item.renmark ?? item.remark ?? '',
            forCustomer: sourceLines
                .map((line) => line.for_customer)
                .filter(Boolean)
                .join(', '),
            refPo: sourceLines
                .map((line) => line.ref_po)
                .filter(Boolean)
                .join(', '),
            prGroupKey: item.id ?? '',
            prSources: sourceLines,
        }));
    };

    const handleAddMaterial = () => {
        if (!canAddMaterial) {
            return;
        }

        const newItem = {
            id: `${Date.now()}-${Math.random()}`,
            kodeMaterial: materialForm.kodeMaterial,
            material: materialForm.material,
            qty: materialForm.qty,
            satuan: materialForm.satuan,
            price: priceWithPpn,
            ppn: ppnValue,
            totalPrice: totalPriceValue,
            remark: materialForm.remark,
            forCustomer: materialForm.forCustomer,
            refPo: materialForm.refPo,
            prGroupKey: materialForm.prGroupKey,
            prSources: materialForm.prSources,
            prTotalQty: parseNumber(materialForm.sisaQty),
        };

        // Buat array baru berisi data lama + data yang baru ditambahkan
        const updatedItems = [...materialItems, newItem];

        setMaterialItems(updatedItems);
        setMaterialForm({
            kodeMaterial: '',
            material: '',
            qty: '',
            sisaQty: '',
            satuan: '',
            basePrice: '',
            remark: '',
            forCustomer: '',
            refPo: '',
            prGroupKey: '',
            prSources: [],
        });
        setIncludePpn(false);

        // --- TRIGGER AUTOFILL AI DI SINI ---
        // Jika material yang ditambahkan punya remark, jalankan AI Clustering
        if (newItem.remark && newItem.remark.trim() !== '') {
            processRemarksCluster(updatedItems);
        }
    };

    const processRemarksCluster = async (items) => {
        // Ambil semua remark yang tidak kosong dari keranjang saat ini
        const remarksArray = items
            .map((item) => item.remark)
            .filter((rem) => rem && rem.trim() !== '');

        if (remarksArray.length > 0) {
            try {
                const response = await axios.post(
                    '/pembelian/purchase-order/cluster-remarks',
                    {
                        remarks: remarksArray,
                    },
                );

                setFormData((prev) => ({
                    ...prev,
                    note1: response.data.clustered_remark ?? prev.note1,
                }));
            } catch (error) {
                console.error('Gagal memproses clustering remark:', error);
            }
        } else {
            // Kosongkan note 1 jika keranjang sudah tidak memiliki material dengan remark
            setFormData((prev) => ({ ...prev, note1: '' }));
        }
    };

    const handleDeleteMaterial = async (idToRemove) => {
        const itemToDelete = materialItems.find(
            (item) => item.id === idToRemove,
        );
        const updatedItems = materialItems.filter(
            (item) => item.id !== idToRemove,
        );

        // Update tabel keranjang
        setMaterialItems(updatedItems);

        // Pengecekan AI Clustering: Hanya jalankan hitung ulang jika item yang dihapus memiliki remark
        if (
            itemToDelete &&
            itemToDelete.remark &&
            itemToDelete.remark.trim() !== ''
        ) {
            processRemarksCluster(updatedItems);
        }
    };

    const totalPriceSum = materialItems.reduce(
        (sum, item) => sum + parseNumber(item.qty) * parseNumber(item.price),
        0,
    );
    const totalPpnSum = materialItems.reduce(
        (sum, item) => sum + parseNumber(item.qty) * parseNumber(item.ppn),
        0,
    );
    const grandTotalSum = totalPriceSum + totalPpnSum;

    const buildReturnPayload = () => {
        const allocations = [];

        materialItems.forEach((item) => {
            const totalAvailable = parseNumber(item.prTotalQty ?? 0);
            const poQty = parseNumber(item.qty);
            const shortage = Math.max(0, totalAvailable - poQty);

            if (shortage <= 0) {
                return;
            }

            const sourceLines = Array.isArray(item.prSources)
                ? item.prSources
                : [];
            const defaultReturns = sourceLines.map((line) => {
                const availableQty = Math.max(
                    0,
                    parseNumber(line.available_qty ?? line.sisa_pr ?? line.qty),
                );
                return shortage > 0 && totalAvailable > 0
                    ? (availableQty / totalAvailable) * shortage
                    : 0;
            });
            const roundedDefaults = defaultReturns.map((value, index) =>
                index === defaultReturns.length - 1
                    ? Math.max(
                          0,
                          shortage -
                              defaultReturns
                                  .slice(0, -1)
                                  .reduce(
                                      (sum, entry) => sum + Math.round(entry),
                                      0,
                                  ),
                      )
                    : Math.round(value),
            );
            const rawAllocations = sourceLines.map((line, index) => {
                const key = `${item.prGroupKey ?? ''}||${getPrCustomerKey(line)}`;
                const value = returnAllocations[key];
                const availableQty = Math.max(
                    0,
                    parseNumber(line.available_qty ?? line.sisa_pr ?? line.qty),
                );
                const returnedQty =
                    value !== undefined
                        ? parseNumber(value)
                        : (roundedDefaults[index] ?? 0);
                return {
                    no_pr: line.no_pr ?? item.refPr ?? formData.refPr,
                    kd_material: line.kd_material ?? item.kodeMaterial,
                    for_customer: line.for_customer ?? '',
                    ref_po: line.ref_po ?? '',
                    available_qty: availableQty,
                    returned_qty: Math.min(availableQty, returnedQty),
                };
            });

            const allocatedReturn = rawAllocations.reduce(
                (sum, row) => sum + parseNumber(row.returned_qty),
                0,
            );

            allocations.push({
                pr_group_key: item.prGroupKey,
                kd_material: item.kodeMaterial,
                material: item.material,
                total_available: totalAvailable,
                po_qty: poQty,
                shortage: Math.max(0, shortage),
                returned_total: allocatedReturn,
                sources: rawAllocations,
            });
        });

        return allocations;
    };

    const postPurchaseOrder = (payload) => {
        router.post('/pembelian/purchase-order', payload, {
            onStart: () => setIsSubmitting(true),
            onError: () => setIsSubmitting(false),
            onSuccess: (page) => {
                if (page?.props?.flash?.error) {
                    setIsSubmitting(false);
                }
            },
        });
    };

    const handleSubmit = () => {
        if (materialItems.length === 0) {
            return;
        }

        const returnPayload = buildReturnPayload();
        const needsReturnModal = returnPayload.some(
            (item) => item.shortage > 0,
        );
        const payload = {
            date: formData.date,
            ref_pr: formData.refPr,
            ref_quota: formData.refQuota,
            for_cus: formData.forCustomer,
            ref_poin: formData.refPoMasuk,
            ppn: formData.ppn,
            nm_vdr: formData.namaVendor,
            kd_vdr: formData.kodeVendor,
            payment_terms: formData.paymentTerms,
            del_time: formData.deliveryTime,
            franco_loco: formData.francoLoco,
            ket1: withRequiredSpace(formData.note1),
            ket2: withRequiredSpace(formData.note2),
            ket3: withRequiredSpace(formData.note3),
            ket4: withRequiredSpace(formData.note4),
            s_total: totalPriceSum,
            h_ppn: totalPpnSum,
            g_total: grandTotalSum,
            materials: materialItems.map((item, index) => ({
                no: index + 1,
                kd_mat: item.kodeMaterial,
                material: item.material,
                qty: item.qty,
                unit: item.satuan,
                price: item.price,
                total_price: item.totalPrice,
                ppn: item.ppn,
                for_customer: item.forCustomer,
                ref_poin: item.refPo,
                pr_group_key: item.prGroupKey,
                pr_total_qty: item.prTotalQty,
            })),
            pr_returns: returnPayload,
        };

        if (needsReturnModal) {
            setPendingSubmitPayload(payload);
            setIsReturnModalOpen(true);
            return;
        }

        postPurchaseOrder(payload);
    };

    const handleConfirmReturnSubmit = () => {
        if (!pendingSubmitPayload) {
            return;
        }

        setIsReturnModalOpen(false);
        postPurchaseOrder(pendingSubmitPayload);
    };

    const updateReturnAllocation = (groupKey, sourceKey, value) => {
        const key = `${groupKey}||${sourceKey}`;
        setReturnAllocations((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    useEffect(() => {
        setPrCurrentPage(1);
    }, [prPageSize, prSearchTerm]);

    useEffect(() => {
        setVendorCurrentPage(1);
    }, [vendorPageSize, vendorSearchTerm]);

    useEffect(() => {
        if (prCurrentPage > prTotalPages) {
            setPrCurrentPage(prTotalPages);
        }
    }, [prCurrentPage, prTotalPages]);

    useEffect(() => {
        if (vendorCurrentPage > vendorTotalPages) {
            setVendorCurrentPage(vendorTotalPages);
        }
    }, [vendorCurrentPage, vendorTotalPages]);

    useEffect(() => {
        if (formData.refPr) {
            loadPrDetails(formData.refPr, formData.selectedCustomers);
        } else {
            setPrDetailList([]);
        }
    }, [formData.refPr, formData.selectedCustomers]);

    useEffect(() => {
        if (includePpn) {
            setFormData((prev) => ({
                ...prev,
                ppn: prev.ppn,
            }));
        }
    }, [includePpn]);

    return (
        <>
            <Head title="Tambah PO" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Tambah PO</h1>
                        <p className="text-sm text-muted-foreground">
                            Isi data PO dalam tiga langkah
                        </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                        Step {step} dari 3
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 text-sm">
                    <span
                        className={`rounded-full px-3 py-1 ${
                            step === 1
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                        }`}
                    >
                        1. Data PO
                    </span>
                    <span
                        className={`rounded-full px-3 py-1 ${
                            step === 2
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                        }`}
                    >
                        2. Data Vendor
                    </span>
                    <span
                        className={`rounded-full px-3 py-1 ${
                            step === 3
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                        }`}
                    >
                        3. Data Material
                    </span>
                </div>

                {step === 1 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Data PO</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-3">
                            <label className="space-y-2 text-sm md:col-span-3">
                                <span className="text-muted-foreground">
                                    Cari PR Outstanding
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setIsPrModalOpen(true);
                                        loadPrs();
                                    }}
                                >
                                    Cari PR
                                </Button>
                            </label>
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
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Ref PR
                                </span>
                                <Input value={formData.refPr} readOnly />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Ref PO Masuk
                                </span>
                                <Input value={formData.refPoMasuk} readOnly />
                            </label>
                            <label className="space-y-2 text-sm md:col-span-3">
                                <span className="text-muted-foreground">
                                    For Customer
                                </span>
                                <Input value={formData.forCustomer} readOnly />
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
                        <CardHeader>
                            <CardTitle>Data Vendor</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <label className="space-y-2 text-sm md:col-span-2">
                                <span className="text-muted-foreground">
                                    Cari Vendor
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setIsVendorModalOpen(true);
                                        loadVendors();
                                    }}
                                >
                                    Cari Vendor
                                </Button>
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Kode Vendor
                                </span>
                                <Input value={formData.kodeVendor} readOnly />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Nama Vendor
                                </span>
                                <Input value={formData.namaVendor} readOnly />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Attended
                                </span>
                                <Input
                                    value={formData.attended}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            attended: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    PPN
                                </span>
                                <Input
                                    type="number"
                                    value={formData.ppn}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            ppn: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Ref Quota
                                </span>
                                <Input
                                    value={formData.refQuota}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            refQuota: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Payment Terms
                                </span>
                                <Input
                                    value={formData.paymentTerms}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            paymentTerms: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Delivery Time
                                </span>
                                <Input
                                    value={formData.deliveryTime}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            deliveryTime: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Franco Loco
                                </span>
                                <Input
                                    value={formData.francoLoco}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            francoLoco: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                        </CardContent>
                        <div className="flex justify-between gap-2 px-6 pb-6">
                            <Button
                                variant="outline"
                                type="button"
                                onClick={() => setStep(1)}
                            >
                                Kembali
                            </Button>
                            <Button type="button" onClick={() => setStep(3)}>
                                Lanjut
                            </Button>
                        </div>
                    </Card>
                )}

                {step === 3 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Data Material</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50 text-muted-foreground">
                                        <tr>
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
                                                Sisa Qty
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                Satuan
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                Remark
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <PlainTableStateRows
                                            columns={6}
                                            loading={
                                                prDetailLoading &&
                                                groupedPrMaterials.length === 0
                                            }
                                            error={
                                                groupedPrMaterials.length === 0
                                                    ? prDetailError
                                                    : null
                                            }
                                            onRetry={
                                                formData.refPr
                                                    ? () =>
                                                          loadPrDetails(
                                                              formData.refPr,
                                                              formData.selectedCustomers,
                                                          )
                                                    : undefined
                                            }
                                            isEmpty={
                                                !prDetailLoading &&
                                                !prDetailError &&
                                                groupedPrMaterials.length === 0
                                            }
                                            emptyTitle="Belum ada material PR."
                                        />
                                        {groupedPrMaterials.map(
                                            (item, index) => (
                                                <tr
                                                    key={`${item.id}-${index}`}
                                                    className="cursor-pointer border-t border-sidebar-border/70"
                                                    onClick={() =>
                                                        handleMaterialSelect(
                                                            item,
                                                        )
                                                    }
                                                >
                                                    <td className="px-4 py-3">
                                                        {renderValue(
                                                            item.kd_material,
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {renderValue(
                                                            item.material,
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {formatInteger(
                                                            item.qty,
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {formatInteger(
                                                            item.sisa_pr,
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {renderValue(item.unit)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {renderValue(
                                                            item.renmark,
                                                        )}
                                                    </td>
                                                </tr>
                                            ),
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label>Kode Material</Label>
                                    <Input
                                        value={materialForm.kodeMaterial}
                                        readOnly
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Material</Label>
                                    <Input
                                        value={materialForm.material}
                                        readOnly
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Qty</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="1"
                                        className={
                                            isQtyExceedsSisa
                                                ? 'border-red-500 focus-visible:ring-red-500'
                                                : ''
                                        }
                                        value={materialForm.qty}
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            if (!/^\d*$/.test(value)) return;
                                            setMaterialForm((prev) => ({
                                                ...prev,
                                                qty: value,
                                            }));
                                        }}
                                    />
                                    {isQtyExceedsSisa && (
                                        <p className="text-xs text-red-600">
                                            Qty melebihi sisa qty (
                                            {renderValue(materialForm.sisaQty)}
                                            ).
                                        </p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label>Satuan</Label>
                                    <Input
                                        value={materialForm.satuan}
                                        onChange={(event) =>
                                            setMaterialForm((prev) => ({
                                                ...prev,
                                                satuan: event.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Price</Label>
                                    <Input
                                        type="text" // Ubah dari number ke text
                                        value={
                                            includePpn
                                                ? priceWithPpn
                                                    ? `Rp. ${new Intl.NumberFormat('id-ID').format(priceWithPpn)}`
                                                    : 'Rp. 0'
                                                : materialForm.basePrice
                                                  ? `Rp. ${new Intl.NumberFormat('id-ID').format(materialForm.basePrice)}`
                                                  : ''
                                        }
                                        readOnly={includePpn}
                                        onChange={(event) => {
                                            // Hanya simpan angka murni ke state agar kalkulasi tidak error
                                            const rawValue =
                                                event.target.value.replace(
                                                    /[^0-9]/g,
                                                    '',
                                                );
                                            setMaterialForm((prev) => ({
                                                ...prev,
                                                basePrice: rawValue,
                                            }));
                                        }}
                                        placeholder="Rp. 0"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>PPN</Label>
                                    <Input
                                        type="number"
                                        value={includePpn ? ppnValue : 0}
                                        readOnly
                                    />
                                </div>
                                <div className="grid gap-2 lg:col-span-2">
                                    <label className="flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={includePpn}
                                            onChange={(event) =>
                                                setIncludePpn(
                                                    event.target.checked,
                                                )
                                            }
                                        />
                                        Include PPN
                                    </label>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Total Price</Label>
                                    <Input
                                        value={
                                            totalPriceValue
                                                ? formatRupiah(totalPriceValue)
                                                : ''
                                        }
                                        readOnly
                                    />
                                </div>
                                <div className="grid gap-2 lg:col-span-2">
                                    <Button
                                        type="button"
                                        onClick={handleAddMaterial}
                                        disabled={!canAddMaterial}
                                    >
                                        Tambah Data
                                    </Button>
                                </div>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50 text-muted-foreground">
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
                                                Price
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                PPN
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                Total Price
                                            </th>
                                            <th className="px-4 py-3 text-left">
                                                Action
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {materialItems.length === 0 && (
                                            <tr>
                                                <td
                                                    className="px-4 py-6 text-center text-muted-foreground"
                                                    colSpan={8}
                                                >
                                                    Belum ada material
                                                    ditambahkan.
                                                </td>
                                            </tr>
                                        )}
                                        {materialItems.map((item, index) => (
                                            <tr
                                                key={item.id}
                                                className="border-t border-sidebar-border/70"
                                            >
                                                <td className="px-4 py-3">
                                                    {index + 1}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(
                                                        item.kodeMaterial,
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(item.material)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(item.qty)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(item.satuan)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(item.price)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(item.ppn)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(
                                                        item.totalPrice,
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleDeleteMaterial(
                                                                item.id,
                                                            )
                                                        }
                                                        className="font-medium text-red-500 transition hover:text-red-700"
                                                    >
                                                        Hapus
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="grid gap-2">
                                    <Label>Total Harga Sebelum PPN</Label>
                                    <Input
                                        value={formatRupiah(totalPriceSum)}
                                        readOnly
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Total PPN</Label>
                                    <Input
                                        value={formatRupiah(totalPpnSum)}
                                        readOnly
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Grand Total</Label>
                                    <Input
                                        value={formatRupiah(grandTotalSum)}
                                        readOnly
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 ...">
                                <label className="space-y-2 text-sm md:col-span-2">
                                    <span className="text-muted-foreground">
                                        Note 1
                                    </span>
                                    <Input
                                        value={formData.note1}
                                        onChange={(event) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                note1: event.target.value,
                                            }))
                                        }
                                    />
                                </label>
                                <label className="space-y-2 text-sm md:col-span-2">
                                    <span className="text-muted-foreground">
                                        Note 2
                                    </span>
                                    <Input
                                        value={formData.note2}
                                        onChange={(event) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                note2: event.target.value,
                                            }))
                                        }
                                    />
                                </label>
                                <label className="space-y-2 text-sm md:col-span-2">
                                    <span className="text-muted-foreground">
                                        Note 3
                                    </span>
                                    <Input
                                        value={formData.note3}
                                        onChange={(event) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                note3: event.target.value,
                                            }))
                                        }
                                    />
                                </label>
                                <label className="space-y-2 text-sm md:col-span-2">
                                    <span className="text-muted-foreground">
                                        Note 4
                                    </span>
                                    <Input
                                        value={formData.note4}
                                        onChange={(event) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                note4: event.target.value,
                                            }))
                                        }
                                    />
                                </label>
                            </div>
                        </CardContent>
                        <div className="flex justify-between gap-2 px-6 pb-6">
                            <Button
                                variant="outline"
                                type="button"
                                onClick={() => setStep(2)}
                            >
                                Kembali
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSubmit}
                                disabled={
                                    isSubmitting || materialItems.length === 0
                                }
                            >
                                {isSubmitting && <Spinner className="mr-2" />}
                                {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                            </Button>
                        </div>
                    </Card>
                )}

                <Dialog
                    open={isPrModalOpen}
                    onOpenChange={(open) => {
                        setIsPrModalOpen(open);
                        if (open) {
                            loadPrs();
                        } else {
                            setPrSearchTerm('');
                            setPrPageSize(5);
                            setPrCurrentPage(1);
                        }
                    }}
                >
                    <DialogContent className="!top-0 !left-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-y-auto !rounded-none">
                        <DialogHeader>
                            <DialogTitle>PR Outstanding</DialogTitle>
                        </DialogHeader>

                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <label>
                                Tampilkan
                                <select
                                    className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                    value={
                                        prPageSize === Infinity
                                            ? 'all'
                                            : prPageSize
                                    }
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setPrPageSize(
                                            value === 'all'
                                                ? Infinity
                                                : Number(value),
                                        );
                                        setPrCurrentPage(1);
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
                                    placeholder="Cari no PR, ref PO, customer..."
                                    value={prSearchTerm}
                                    onChange={(event) =>
                                        setPrSearchTerm(event.target.value)
                                    }
                                />
                            </label>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 text-left">
                                            No PR
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Date
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Customer
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Ref PO
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <PlainTableStateRows
                                        columns={5}
                                        loading={
                                            prLoading &&
                                            displayedPr.length === 0
                                        }
                                        error={
                                            displayedPr.length === 0
                                                ? prError
                                                : null
                                        }
                                        onRetry={loadPrs}
                                        isEmpty={
                                            !prLoading &&
                                            !prError &&
                                            displayedPr.length === 0
                                        }
                                        emptyTitle="Tidak ada PR outstanding."
                                    />
                                    {displayedPr.map((item) => {
                                        const customers = getPrCustomers(item);
                                        const isBlocked = Boolean(
                                            item.all_customers_blocked,
                                        );

                                        return (
                                            <tr
                                                key={`${item.no_pr}-${item.for_customer}-${item.ref_po}`}
                                                className="border-t border-sidebar-border/70"
                                            >
                                                <td className="px-4 py-3">
                                                    {renderValue(item.no_pr)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {renderValue(item.date)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="space-y-2">
                                                        {customers.map(
                                                            (customer) => (
                                                                <div
                                                                    key={`${customer.for_customer}-${customer.ref_po}`}
                                                                    className="flex flex-wrap items-center gap-2"
                                                                >
                                                                    <span>
                                                                        {renderValue(
                                                                            customer.for_customer,
                                                                        )}
                                                                    </span>
                                                                    {hasOverdueMoreThan90Days(
                                                                        customer,
                                                                    ) && (
                                                                        <Badge variant="destructive">
                                                                            Tunggakan
                                                                            &gt;
                                                                            90
                                                                            hari
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            ),
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="space-y-2">
                                                        {customers.map(
                                                            (customer) => (
                                                                <div
                                                                    key={`${customer.for_customer}-${customer.ref_po}`}
                                                                >
                                                                    {renderValue(
                                                                        customer.ref_po,
                                                                    )}
                                                                </div>
                                                            ),
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col items-start gap-1">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            disabled={isBlocked}
                                                            title={
                                                                isBlocked
                                                                    ? 'Customer memiliki tunggakan tagihan > 90 hari, tidak dapat dibuatkan PO keluar.'
                                                                    : undefined
                                                            }
                                                            onClick={() =>
                                                                handlePrSelect(
                                                                    item,
                                                                )
                                                            }
                                                        >
                                                            Pilih
                                                        </Button>
                                                        {isBlocked && (
                                                            <span className="max-w-48 text-xs leading-snug text-red-600">
                                                                Tidak dapat
                                                                dibuatkan PO
                                                                keluar.
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {prPageSize !== Infinity && prTotalItems > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                <span>
                                    Menampilkan{' '}
                                    {Math.min(
                                        (prCurrentPage - 1) * prPageSize + 1,
                                        prTotalItems,
                                    )}
                                    -
                                    {Math.min(
                                        prCurrentPage * prPageSize,
                                        prTotalItems,
                                    )}{' '}
                                    dari {prTotalItems} data
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setPrCurrentPage((page) =>
                                                Math.max(1, page - 1),
                                            )
                                        }
                                        disabled={prCurrentPage === 1}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span className="text-sm text-muted-foreground">
                                        Halaman {prCurrentPage} dari{' '}
                                        {prTotalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setPrCurrentPage((page) =>
                                                Math.min(
                                                    prTotalPages,
                                                    page + 1,
                                                ),
                                            )
                                        }
                                        disabled={
                                            prCurrentPage === prTotalPages
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
                    open={blockedPr !== null}
                    onOpenChange={(open) => {
                        if (!open) setBlockedPr(null);
                    }}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                PO Keluar Tidak Dapat Dibuat
                            </DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-muted-foreground">
                            Customer{' '}
                            <span className="font-semibold text-foreground">
                                {getPrCustomers(blockedPr)
                                    .filter(hasOverdueMoreThan90Days)
                                    .map(
                                        (customer) =>
                                            `${renderValue(customer.for_customer)} (ref PO ${renderValue(customer.ref_po)})`,
                                    )
                                    .join(', ')}
                            </span>{' '}
                            tidak bisa dibuat PO keluar karena memiliki
                            tunggakan lebih dari 90 hari. Hanya customer tanpa
                            tunggakan tersebut yang akan diproses.
                        </p>
                        <div className="flex justify-end">
                            <Button
                                type="button"
                                onClick={() => {
                                    const selectedPr = blockedPr;
                                    setBlockedPr(null);
                                    applyPrSelection(selectedPr);
                                }}
                            >
                                Lanjutkan
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={isVendorModalOpen}
                    onOpenChange={(open) => {
                        setIsVendorModalOpen(open);
                        if (open) {
                            loadVendors();
                        } else {
                            setVendorSearchTerm('');
                            setVendorPageSize(5);
                            setVendorCurrentPage(1);
                        }
                    }}
                >
                    <DialogContent className="!top-0 !left-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-y-auto !rounded-none">
                        <DialogHeader>
                            <DialogTitle>Data Vendor</DialogTitle>
                        </DialogHeader>

                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <label>
                                Tampilkan
                                <select
                                    className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                    value={
                                        vendorPageSize === Infinity
                                            ? 'all'
                                            : vendorPageSize
                                    }
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setVendorPageSize(
                                            value === 'all'
                                                ? Infinity
                                                : Number(value),
                                        );
                                        setVendorCurrentPage(1);
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
                                    placeholder="Cari nama vendor..."
                                    value={vendorSearchTerm}
                                    onChange={(event) =>
                                        setVendorSearchTerm(event.target.value)
                                    }
                                />
                            </label>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 text-left">
                                            Kode Vendor
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Nama Vendor
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Alamat
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Attended
                                        </th>
                                        <th className="px-4 py-3 text-left">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <PlainTableStateRows
                                        columns={5}
                                        loading={
                                            vendorLoading &&
                                            displayedVendors.length === 0
                                        }
                                        error={
                                            displayedVendors.length === 0
                                                ? vendorError
                                                : null
                                        }
                                        onRetry={loadVendors}
                                        isEmpty={
                                            !vendorLoading &&
                                            !vendorError &&
                                            displayedVendors.length === 0
                                        }
                                        emptyTitle="Tidak ada data vendor."
                                    />
                                    {displayedVendors.map((item) => (
                                        <tr
                                            key={item.kd_vdr}
                                            className="border-t border-sidebar-border/70"
                                        >
                                            <td className="px-4 py-3">
                                                {renderValue(item.kd_vdr)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {renderValue(item.nm_vdr)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {renderValue(item.almt_vdr)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {renderValue(item.attn_vdr)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        handleVendorSelect(item)
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

                        {vendorPageSize !== Infinity &&
                            vendorTotalItems > 0 && (
                                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                    <span>
                                        Menampilkan{' '}
                                        {Math.min(
                                            (vendorCurrentPage - 1) *
                                                vendorPageSize +
                                                1,
                                            vendorTotalItems,
                                        )}
                                        -
                                        {Math.min(
                                            vendorCurrentPage * vendorPageSize,
                                            vendorTotalItems,
                                        )}{' '}
                                        dari {vendorTotalItems} data
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setVendorCurrentPage((page) =>
                                                    Math.max(1, page - 1),
                                                )
                                            }
                                            disabled={vendorCurrentPage === 1}
                                        >
                                            Sebelumnya
                                        </Button>
                                        <span className="text-sm text-muted-foreground">
                                            Halaman {vendorCurrentPage} dari{' '}
                                            {vendorTotalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setVendorCurrentPage((page) =>
                                                    Math.min(
                                                        vendorTotalPages,
                                                        page + 1,
                                                    ),
                                                )
                                            }
                                            disabled={
                                                vendorCurrentPage ===
                                                vendorTotalPages
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
                    open={isReturnModalOpen}
                    onOpenChange={(open) => {
                        setIsReturnModalOpen(open);
                        if (!open) {
                            setPendingSubmitPayload(null);
                            setReturnAllocations({});
                        }
                    }}
                >
                    <DialogContent className="max-w-4xl">
                        <DialogHeader>
                            <DialogTitle>Sisa Qty PR</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Qty PO lebih kecil dari total qty PR. Tentukan
                                qty yang dikembalikan ke customer/ref PO
                                masing-masing.
                            </p>
                            <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
                                {(pendingSubmitPayload?.pr_returns ?? []).map(
                                    (group) => (
                                        <div
                                            key={group.pr_group_key}
                                            className="rounded-xl border border-sidebar-border/70 p-4"
                                        >
                                            <div className="mb-3">
                                                <p className="font-semibold">
                                                    {group.material}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {group.kd_material} • Total
                                                    PR{' '}
                                                    {formatInteger(
                                                        group.total_available,
                                                    )}{' '}
                                                    • PO{' '}
                                                    {formatInteger(
                                                        group.po_qty,
                                                    )}{' '}
                                                    • Sisa{' '}
                                                    {formatInteger(
                                                        group.shortage,
                                                    )}
                                                </p>
                                            </div>
                                            <div className="grid gap-3">
                                                {group.sources.map((source) => {
                                                    const sourceKey =
                                                        getPrCustomerKey(
                                                            source,
                                                        );
                                                    const allocationKey = `${group.pr_group_key}||${sourceKey}`;
                                                    return (
                                                        <div
                                                            key={allocationKey}
                                                            className="grid gap-2 rounded-lg bg-muted/30 p-3 md:grid-cols-[minmax(0,1fr)_180px]"
                                                        >
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-medium">
                                                                    {source.for_customer ||
                                                                        '-'}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Ref PO:{' '}
                                                                    {source.ref_po ||
                                                                        '-'}{' '}
                                                                    • Available:{' '}
                                                                    {formatInteger(
                                                                        source.available_qty,
                                                                    )}
                                                                </p>
                                                            </div>
                                                            <div className="grid gap-1">
                                                                <Label className="text-xs">
                                                                    Qty
                                                                    dikembalikan
                                                                </Label>
                                                                <Input
                                                                    type="number"
                                                                    min="0"
                                                                    max={String(
                                                                        source.available_qty,
                                                                    )}
                                                                    value={
                                                                        returnAllocations[
                                                                            allocationKey
                                                                        ] ??
                                                                        source.returned_qty ??
                                                                        0
                                                                    }
                                                                    onChange={(
                                                                        event,
                                                                    ) =>
                                                                        updateReturnAllocation(
                                                                            group.pr_group_key,
                                                                            sourceKey,
                                                                            event
                                                                                .target
                                                                                .value,
                                                                        )
                                                                    }
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ),
                                )}
                            </div>
                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setIsReturnModalOpen(false);
                                        setPendingSubmitPayload(null);
                                        setReturnAllocations({});
                                    }}
                                >
                                    Batal
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleConfirmReturnSubmit}
                                    disabled={!pendingSubmitPayload}
                                >
                                    Lanjut Simpan
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}
PurchaseOrderCreate.layout = (page) => (
    <AppLayout children={page} breadcrumbs={breadcrumbs} />
);
