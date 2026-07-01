import { PlainTableStateRows } from '@/components/data-states/TableStateRows';
import InvoiceDetailDialog from '@/components/InvoiceDetailDialog';
import OverdueInvoiceWarningDialog from '@/components/OverdueInvoiceWarningDialog';
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
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router } from '@inertiajs/react';
import {
    AlertCircle,
    ClipboardCheck,
    Eye,
    Pencil,
    Printer,
    ShieldCheck,
    Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/purchase-requirement' },
    { title: 'Purchase Requirement', href: '/marketing/purchase-requirement' },
];

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const normalizeCustomerName = (value) =>
    String(value ?? '')
        .trim()
        .toLowerCase();

const getValue = (source, keys) => {
    for (const key of keys) {
        const value = source?.[key];
        if (value !== null && value !== undefined && value !== '') {
            return value;
        }
    }
    return '-';
};

const formatRupiah = (value) => {
    const number = Number(
        typeof value === 'string' ? value.replace(/,/g, '').trim() : value,
    );
    if (Number.isNaN(number)) return '-';
    return `Rp. ${new Intl.NumberFormat('id-ID').format(number)}`;
};

const parseFlexibleDate = (value) => {
    const text = String(value ?? '').trim();
    if (!text) return null;

    const ymd = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (ymd) {
        const date = new Date(
            Number(ymd[1]),
            Number(ymd[2]) - 1,
            Number(ymd[3]),
        );
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const dmy = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
    if (dmy) {
        const year =
            String(dmy[3]).length === 2
                ? Number(`20${dmy[3]}`)
                : Number(dmy[3]);
        const date = new Date(year, Number(dmy[2]) - 1, Number(dmy[1]));
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isInDateFilter = (value, filter, startDate, endDate) => {
    if (filter === 'all') return true;

    const date = parseFlexibleDate(value);
    if (!date) return false;

    const normalized = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
    );
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (filter === 'today') {
        return normalized.getTime() === today.getTime();
    }

    if (filter === 'this_week') {
        const day = today.getDay();
        const diffToMonday = day === 0 ? 6 : day - 1;
        const start = new Date(today);
        start.setDate(today.getDate() - diffToMonday);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        return normalized >= start && normalized <= end;
    }

    if (filter === 'this_month') {
        return (
            normalized.getMonth() === today.getMonth() &&
            normalized.getFullYear() === today.getFullYear()
        );
    }

    if (filter === 'this_year') {
        return normalized.getFullYear() === today.getFullYear();
    }

    if (filter === 'range') {
        const start = parseFlexibleDate(startDate);
        const end = parseFlexibleDate(endDate);
        if (!start || !end) return false;
        const normalizedStart = new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate(),
        );
        const normalizedEnd = new Date(
            end.getFullYear(),
            end.getMonth(),
            end.getDate(),
        );
        return normalized >= normalizedStart && normalized <= normalizedEnd;
    }

    return true;
};

export default function PurchaseRequirementIndex({
    purchaseRequirements = [],
    outstandingCount = 0,
    sisaPoCount = 0,
    realizedCount = 0,
    outstandingTotal = 0,
    sisaPoTotal = 0,
    realizedTotal = 0,
    period = 'today',
    realizedDeferred = false,
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    const [purchaseRequirementsList, setPurchaseRequirementsList] = useState(
        [],
    );

    const [statusFilter, setStatusFilter] = useState('outstanding');
    const [tableDateFilter, setTableDateFilter] = useState('all');
    const [tableStartDate, setTableStartDate] = useState('');
    const [tableEndDate, setTableEndDate] = useState('');
    const [periodFilter, setPeriodFilter] = useState(period ?? 'today');

    const [outstandingCountState, setOutstandingCountState] =
        useState(outstandingCount);
    const [outstandingTotalState, setOutstandingTotalState] =
        useState(outstandingTotal);
    const [sisaPoCountState, setSisaPoCountState] = useState(sisaPoCount);
    const [sisaPoTotalState, setSisaPoTotalState] = useState(sisaPoTotal);
    const [realizedCountState, setRealizedCountState] = useState(realizedCount);
    const [realizedTotalState, setRealizedTotalState] = useState(realizedTotal);

    const [tableLoading, setTableLoading] = useState(false);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [isRealizedLoading, setIsRealizedLoading] = useState(false);

    const [pageSize, setPageSize] = useState(5);
    const [currentPage, setCurrentPage] = useState(1);

    const [selectedPr, setSelectedPr] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isOutstandingModalOpen, setIsOutstandingModalOpen] = useState(false);
    const [isSisaPoModalOpen, setIsSisaPoModalOpen] = useState(false);
    const [isRealizedModalOpen, setIsRealizedModalOpen] = useState(false);

    const [outstandingSearchTerm, setOutstandingSearchTerm] = useState('');
    const [debouncedOutstandingSearchTerm, setDebouncedOutstandingSearchTerm] =
        useState('');
    const [outstandingPageSize, setOutstandingPageSize] = useState(5);
    const [outstandingCurrentPage, setOutstandingCurrentPage] = useState(1);

    const [sisaPoSearchTerm, setSisaPoSearchTerm] = useState('');
    const [debouncedSisaPoSearchTerm, setDebouncedSisaPoSearchTerm] =
        useState('');
    const [sisaPoPageSize, setSisaPoPageSize] = useState(5);
    const [sisaPoCurrentPage, setSisaPoCurrentPage] = useState(1);

    const [realizedSearchTerm, setRealizedSearchTerm] = useState('');
    const [debouncedRealizedSearchTerm, setDebouncedRealizedSearchTerm] =
        useState('');
    const [realizedPageSize, setRealizedPageSize] = useState(5);
    const [realizedCurrentPage, setRealizedCurrentPage] = useState(1);

    const [materialSearchTerm, setMaterialSearchTerm] = useState('');
    const [debouncedMaterialSearchTerm, setDebouncedMaterialSearchTerm] =
        useState('');
    const [materialPageSize, setMaterialPageSize] = useState(5);
    const [materialCurrentPage, setMaterialCurrentPage] = useState(1);

    const [selectedDetails, setSelectedDetails] = useState([]);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');

    const [outstandingList, setOutstandingList] = useState([]);
    const [outstandingLoading, setOutstandingLoading] = useState(false);
    const [outstandingError, setOutstandingError] = useState('');

    const [sisaPoList, setSisaPoList] = useState([]);
    const [sisaPoLoading, setSisaPoLoading] = useState(false);
    const [sisaPoError, setSisaPoError] = useState('');

    const [realizedList, setRealizedList] = useState([]);
    const [realizedLoading, setRealizedLoading] = useState(false);
    const [realizedError, setRealizedError] = useState('');

    const [isDeleting, setIsDeleting] = useState(false);
    const [overdueCustomers, setOverdueCustomers] = useState(new Set());
    const [overdueDialogOpen, setOverdueDialogOpen] = useState(false);
    const [overdueDialogData, setOverdueDialogData] = useState(null);
    const [overdueDialogLoading, setOverdueDialogLoading] = useState(false);
    const [selectedInvoiceNo, setSelectedInvoiceNo] = useState('');
    const [invoiceDetailOpen, setInvoiceDetailOpen] = useState(false);

    const handleOpenOverdueDialog = useCallback(async (customer) => {
        const normalizedCustomer = String(customer ?? '').trim();
        if (!normalizedCustomer) return;

        setOverdueDialogOpen(true);
        setOverdueDialogLoading(true);
        setOverdueDialogData({
            customer: normalizedCustomer,
            total_overdue: 0,
            oldest_overdue_days: 0,
            invoices: [],
        });

        try {
            const params = new URLSearchParams({
                customer: normalizedCustomer,
            });
            const response = await fetch(
                `/marketing/purchase-requirement/overdue-invoices?${params.toString()}`,
                { headers: { Accept: 'application/json' } },
            );

            if (!response.ok) {
                throw new Error('Failed to load overdue invoices.');
            }

            setOverdueDialogData(await response.json());
        } catch (error) {
            console.error('Error fetching overdue invoices:', error);
            Swal.fire({
                icon: 'error',
                title: 'Gagal memuat tunggakan',
                text: 'Data tunggakan tagihan customer tidak dapat dimuat.',
            });
            setOverdueDialogOpen(false);
        } finally {
            setOverdueDialogLoading(false);
        }
    }, []);

    const renderCustomerWithOverdueMarker = (customer) => {
        const value = renderValue(customer);
        const hasOverdue = overdueCustomers.has(
            normalizeCustomerName(customer),
        );

        return (
            <div className="flex min-w-0 flex-nowrap items-center gap-2">
                <span className="truncate">{value}</span>
                {hasOverdue && (
                    <button
                        type="button"
                        className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-red-700 uppercase transition hover:border-red-300 hover:bg-red-100"
                        onClick={() => handleOpenOverdueDialog(customer)}
                        disabled={overdueDialogLoading}
                        title="Lihat tunggakan tagihan"
                    >
                        Overdue
                    </button>
                )}
            </div>
        );
    };

    useEffect(() => {
        fetch('/penjualan/review-tagihan/overdue-customer-names', {
            headers: { Accept: 'application/json' },
        })
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => {
                const names = Array.isArray(data?.customers)
                    ? data.customers
                    : [];
                setOverdueCustomers(
                    new Set(names.map((name) => normalizeCustomerName(name))),
                );
            })
            .catch(() => setOverdueCustomers(new Set()));
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        const timer = setTimeout(
            () => setDebouncedOutstandingSearchTerm(outstandingSearchTerm),
            300,
        );
        return () => clearTimeout(timer);
    }, [outstandingSearchTerm]);

    useEffect(() => {
        const timer = setTimeout(
            () => setDebouncedSisaPoSearchTerm(sisaPoSearchTerm),
            300,
        );
        return () => clearTimeout(timer);
    }, [sisaPoSearchTerm]);

    useEffect(() => {
        const timer = setTimeout(
            () => setDebouncedRealizedSearchTerm(realizedSearchTerm),
            300,
        );
        return () => clearTimeout(timer);
    }, [realizedSearchTerm]);

    useEffect(() => {
        const timer = setTimeout(
            () => setDebouncedMaterialSearchTerm(materialSearchTerm),
            300,
        );
        return () => clearTimeout(timer);
    }, [materialSearchTerm]);

    const fetchTableData = useCallback(
        async (newPeriod, currentStatus, startDate = '', endDate = '') => {
            setTableLoading(true);
            try {
                // JIKA STATUS TEREALISASI, AMBIL LANGSUNG DARI ENDPOINT MILIK CARD!
                if (currentStatus === 'realized') {
                    const params = new URLSearchParams({ period: newPeriod });
                    const response = await fetch(
                        `/marketing/purchase-requirement/realized?${params.toString()}`,
                        {
                            headers: { Accept: 'application/json' },
                        },
                    );
                    const data = await response.json();

                    const list = Array.isArray(data?.purchaseRequirements)
                        ? data.purchaseRequirements
                        : [];
                    const optimizedList = list.map((item) => {
                        const parsed = parseFlexibleDate(item.date);
                        return {
                            ...item,
                            _parsedDateTs: parsed ? parsed.getTime() : null,
                        };
                    });

                    setPurchaseRequirementsList(optimizedList);
                    setTableLoading(false);
                    return;
                }

                // JIKA BUKAN TEREALISASI, AMBIL DARI ENDPOINT TABEL BIASA
                let url = `/marketing/purchase-requirement/data?period=${newPeriod}&fetch_type=table&status=${currentStatus}`;
                if (newPeriod === 'range' && startDate && endDate) {
                    url += `&start_date=${startDate}&end_date=${endDate}`;
                }

                const response = await fetch(url, {
                    headers: { Accept: 'application/json' },
                });
                const data = await response.json();

                const rawList = data.purchaseRequirements || [];
                const optimizedList = rawList.map((item) => {
                    const parsed = parseFlexibleDate(item.date);
                    return {
                        ...item,
                        _parsedDateTs: parsed ? parsed.getTime() : null,
                    };
                });

                setPurchaseRequirementsList(optimizedList);
            } catch (error) {
                console.error('Error fetching PR Table data:', error);
            } finally {
                setTableLoading(false);
            }
        },
        [],
    );

    const fetchSummaryData = useCallback(async (newPeriod) => {
        setSummaryLoading(true);
        try {
            const response = await fetch(
                `/marketing/purchase-requirement/data?period=${newPeriod}&fetch_type=summary`,
                { headers: { Accept: 'application/json' } },
            );
            const data = await response.json();
            setOutstandingCountState(data.outstandingCount || 0);
            setOutstandingTotalState(data.outstandingTotal || 0);
            setSisaPoCountState(data.sisaPoCount || 0);
            setSisaPoTotalState(data.sisaPoTotal || 0);
            setRealizedCountState(data.realizedCount || 0);
            setRealizedTotalState(data.realizedTotal || 0);
        } catch (error) {
            console.error('Error fetching PR Summary data:', error);
        } finally {
            setSummaryLoading(false);
        }
    }, []);

    // --- PERBAIKAN: Hanya fetch sekali di awal, tidak di-trigger ulang oleh periodFilter dari card! ---
    // Effect 1: Mengurus Summary Card bagian atas
    const isInitialMount = useRef(true);
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            if (!purchaseRequirements || purchaseRequirements.length === 0) {
                setSummaryLoading(true);
                fetchSummaryData(period ?? 'today');
            }
        } else {
            fetchSummaryData(period ?? 'today');
        }
    }, [period, fetchSummaryData]);

    // Effect 2: Mengurus Data Tabel (Akan Fetch saat Tanggal ATAU Status diubah)
    const isTableMounted = useRef(false);
    useEffect(() => {
        if (!isTableMounted.current) {
            isTableMounted.current = true;
            if (
                purchaseRequirements?.length > 0 &&
                tableDateFilter === 'all' &&
                statusFilter === 'outstanding'
            ) {
                return;
            }
        }

        if (tableDateFilter === 'range' && (!tableStartDate || !tableEndDate)) {
            return;
        }

        // Memanggil data dengan menyertakan statusFilter!
        fetchTableData(
            tableDateFilter,
            statusFilter,
            tableStartDate,
            tableEndDate,
        );
    }, [
        tableDateFilter,
        statusFilter,
        tableStartDate,
        tableEndDate,
        fetchTableData,
    ]);

    useEffect(() => {
        if (purchaseRequirements?.length > 0) {
            const timer = setTimeout(() => {
                const optimizedList = purchaseRequirements.map((item) => {
                    const parsed = parseFlexibleDate(item.date);
                    return {
                        ...item,
                        _parsedDateTs: parsed ? parsed.getTime() : null,
                    };
                });
                setPurchaseRequirementsList(optimizedList);
            }, 10);
            return () => clearTimeout(timer);
        } else {
            setPurchaseRequirementsList([]);
        }
    }, [purchaseRequirements]);

    useEffect(() => {
        setOutstandingCountState(outstandingCount);
        setOutstandingTotalState(outstandingTotal);
        setSisaPoCountState(sisaPoCount);
        setSisaPoTotalState(sisaPoTotal);
    }, [outstandingCount, outstandingTotal, sisaPoCount, sisaPoTotal]);

    useEffect(() => {
        if (!realizedDeferred) return;
        loadRealized(periodFilter, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [realizedDeferred]);

    const dateFilterBounds = useMemo(() => {
        if (tableDateFilter === 'all') return null;

        const now = new Date();
        const today = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
        );
        let start, end;

        if (tableDateFilter === 'today') {
            start = today;
            end = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
        } else if (tableDateFilter === 'this_week') {
            const day = today.getDay();
            const diffToMonday = day === 0 ? 6 : day - 1;
            start = new Date(today);
            start.setDate(today.getDate() - diffToMonday);
            end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
        } else if (tableDateFilter === 'this_month') {
            start = new Date(today.getFullYear(), today.getMonth(), 1);
            end = new Date(
                today.getFullYear(),
                today.getMonth() + 1,
                0,
                23,
                59,
                59,
                999,
            );
        } else if (tableDateFilter === 'this_year') {
            start = new Date(today.getFullYear(), 0, 1);
            end = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
        } else if (tableDateFilter === 'range') {
            const s = parseFlexibleDate(tableStartDate);
            const e = parseFlexibleDate(tableEndDate);
            if (!s || !e) return { start: Infinity, end: -Infinity };
            start = new Date(s.getFullYear(), s.getMonth(), s.getDate());
            end = new Date(
                e.getFullYear(),
                e.getMonth(),
                e.getDate(),
                23,
                59,
                59,
                999,
            );
        }
        return { start: start.getTime(), end: end.getTime() };
    }, [tableDateFilter, tableStartDate, tableEndDate]);

    const filteredPurchaseRequirements = useMemo(() => {
        const term = debouncedSearchTerm.trim().toLowerCase();

        const filtered = purchaseRequirementsList.filter((item) => {
            // KEMBALIKAN FILTER TANGGAL: Agar bisa membaca data dari Card dengan benar
            if (dateFilterBounds) {
                if (!item._parsedDateTs) return false;
                if (
                    item._parsedDateTs < dateFilterBounds.start ||
                    item._parsedDateTs > dateFilterBounds.end
                ) {
                    return false;
                }
            }

            const outstanding = Number(item.outstanding_count ?? 0) > 0;
            const sisaPoStatus = Number(item.sisa_po_count ?? 0) > 0;

            // LOGIKA KETAT TEREALISASI: 100% Sesuai Card (Semua material sudah tidak ada sisa PR)
            const realized = !outstanding && !sisaPoStatus;

            if (statusFilter === 'outstanding' && !outstanding) return false;
            if (statusFilter === 'sisa_po' && !sisaPoStatus) return false;
            if (statusFilter === 'realized' && !realized) return false;

            if (!term) return true;

            const values = [
                item.no_pr,
                item.date,
                item.for_customer,
                item.ref_po,
            ];
            return values.some((value) =>
                String(value ?? '')
                    .toLowerCase()
                    .includes(term),
            );
        });

        return filtered.sort((a, b) =>
            String(b.no_pr ?? '').localeCompare(String(a.no_pr ?? '')),
        );
    }, [
        purchaseRequirementsList,
        debouncedSearchTerm,
        statusFilter,
        dateFilterBounds,
    ]);

    const totalItems = filteredPurchaseRequirements.length;
    const totalPages = useMemo(() => {
        if (pageSize === Infinity) return 1;
        return Math.max(1, Math.ceil(totalItems / pageSize));
    }, [pageSize, totalItems]);

    const displayedPurchaseRequirements = useMemo(() => {
        if (pageSize === Infinity) return filteredPurchaseRequirements;
        const startIndex = (currentPage - 1) * pageSize;
        return filteredPurchaseRequirements.slice(
            startIndex,
            startIndex + pageSize,
        );
    }, [currentPage, filteredPurchaseRequirements, pageSize]);

    const outstandingPurchaseRequirements = useMemo(() => {
        const term = debouncedOutstandingSearchTerm.trim().toLowerCase();
        return outstandingList
            .map((item) => ({
                ...item,
                _canDelete:
                    Number(item.can_delete ?? item.canDelete ?? 0) === 1,
            }))
            .filter((item) => {
                const outstanding = Number(item.outstanding_count ?? 0) > 0;
                if (!outstanding) return false;
                if (!term) return true;

                const values = [
                    item.no_pr,
                    item.date,
                    item.for_customer,
                    item.ref_po,
                ];
                return values.some((value) =>
                    String(value ?? '')
                        .toLowerCase()
                        .includes(term),
                );
            })
            .sort((a, b) =>
                String(b.no_pr ?? '').localeCompare(String(a.no_pr ?? '')),
            );
    }, [outstandingList, debouncedOutstandingSearchTerm]);

    const outstandingTotalItems = outstandingPurchaseRequirements.length;
    const outstandingTotalPages = useMemo(() => {
        if (outstandingPageSize === Infinity) return 1;
        return Math.max(
            1,
            Math.ceil(outstandingTotalItems / outstandingPageSize),
        );
    }, [outstandingPageSize, outstandingTotalItems]);

    const displayedOutstandingPurchaseRequirements = useMemo(() => {
        if (outstandingPageSize === Infinity)
            return outstandingPurchaseRequirements;
        const startIndex = (outstandingCurrentPage - 1) * outstandingPageSize;
        return outstandingPurchaseRequirements.slice(
            startIndex,
            startIndex + outstandingPageSize,
        );
    }, [
        outstandingCurrentPage,
        outstandingPageSize,
        outstandingPurchaseRequirements,
    ]);

    const sisaPoPurchaseRequirements = useMemo(() => {
        const term = debouncedSisaPoSearchTerm.trim().toLowerCase();
        return sisaPoList
            .map((item) => ({
                ...item,
                _canDelete:
                    Number(item.can_delete ?? item.canDelete ?? 0) === 1,
            }))
            .filter((item) => {
                if (!term) return true;
                const values = [
                    item.no_pr,
                    item.date,
                    item.for_customer,
                    item.ref_po,
                ];
                return values.some((value) =>
                    String(value ?? '')
                        .toLowerCase()
                        .includes(term),
                );
            })
            .sort((a, b) =>
                String(b.no_pr ?? '').localeCompare(String(a.no_pr ?? '')),
            );
    }, [sisaPoList, debouncedSisaPoSearchTerm]);

    const sisaPoTotalItems = sisaPoPurchaseRequirements.length;
    const sisaPoTotalPages = useMemo(() => {
        if (sisaPoPageSize === Infinity) return 1;
        return Math.max(1, Math.ceil(sisaPoTotalItems / sisaPoPageSize));
    }, [sisaPoPageSize, sisaPoTotalItems]);

    const displayedSisaPoPurchaseRequirements = useMemo(() => {
        if (sisaPoPageSize === Infinity) return sisaPoPurchaseRequirements;
        const startIndex = (sisaPoCurrentPage - 1) * sisaPoPageSize;
        return sisaPoPurchaseRequirements.slice(
            startIndex,
            startIndex + sisaPoPageSize,
        );
    }, [sisaPoCurrentPage, sisaPoPageSize, sisaPoPurchaseRequirements]);

    const realizedPurchaseRequirements = useMemo(() => {
        const term = debouncedRealizedSearchTerm.trim().toLowerCase();
        return realizedList
            .filter((item) => {
                if (!term) return true;
                const values = [
                    item.no_pr,
                    item.date,
                    item.for_customer,
                    item.ref_po,
                ];
                return values.some((value) =>
                    String(value ?? '')
                        .toLowerCase()
                        .includes(term),
                );
            })
            .sort((a, b) =>
                String(b.no_pr ?? '').localeCompare(String(a.no_pr ?? '')),
            );
    }, [realizedList, debouncedRealizedSearchTerm]);

    const realizedTotalItems = realizedPurchaseRequirements.length;
    const realizedTotalPages = useMemo(() => {
        if (realizedPageSize === Infinity) return 1;
        return Math.max(1, Math.ceil(realizedTotalItems / realizedPageSize));
    }, [realizedPageSize, realizedTotalItems]);

    const displayedRealizedPurchaseRequirements = useMemo(() => {
        if (realizedPageSize === Infinity) return realizedPurchaseRequirements;
        const startIndex = (realizedCurrentPage - 1) * realizedPageSize;
        return realizedPurchaseRequirements.slice(
            startIndex,
            startIndex + realizedPageSize,
        );
    }, [realizedCurrentPage, realizedPageSize, realizedPurchaseRequirements]);

    const filteredMaterialDetails = useMemo(() => {
        const term = debouncedMaterialSearchTerm.trim().toLowerCase();
        if (!term) return selectedDetails;

        return selectedDetails.filter((detail) => {
            const values = [
                detail.material,
                detail.Material,
                detail.qty,
                detail.Qty,
                detail.satuan,
                detail.Satuan,
                detail.sisa_pr,
                detail.Sisa_pr,
                detail.remark,
                detail.Remark,
            ];
            return values.some((value) =>
                String(value ?? '')
                    .toLowerCase()
                    .includes(term),
            );
        });
    }, [debouncedMaterialSearchTerm, selectedDetails]);

    const materialTotalItems = filteredMaterialDetails.length;
    const materialTotalPages = useMemo(() => {
        if (materialPageSize === Infinity) return 1;
        return Math.max(1, Math.ceil(materialTotalItems / materialPageSize));
    }, [materialPageSize, materialTotalItems]);

    const displayedMaterialDetails = useMemo(() => {
        if (materialPageSize === Infinity) return filteredMaterialDetails;
        const startIndex = (materialCurrentPage - 1) * materialPageSize;
        return filteredMaterialDetails.slice(
            startIndex,
            startIndex + materialPageSize,
        );
    }, [filteredMaterialDetails, materialCurrentPage, materialPageSize]);

    const handleOpenModal = (item) => {
        setSelectedPr(item);
        setIsModalOpen(true);
        setSelectedDetails([]);
        setDetailError('');
        setDetailLoading(true);
        setMaterialSearchTerm('');
        setDebouncedMaterialSearchTerm('');
        setMaterialPageSize(5);
        setMaterialCurrentPage(1);

        const params = new URLSearchParams({ no_pr: item.no_pr });
        fetch(`/marketing/purchase-requirement/details?${params.toString()}`, {
            headers: { Accept: 'application/json' },
        })
            .then((response) => {
                if (!response.ok) throw new Error('Request failed');
                return response.json();
            })
            .then((data) => {
                setSelectedDetails(
                    Array.isArray(data?.purchaseRequirementDetails)
                        ? data.purchaseRequirementDetails
                        : [],
                );
            })
            .catch(() => setDetailError('Gagal memuat detail PR.'))
            .finally(() => setDetailLoading(false));
    };

    const loadOutstanding = (force = false) => {
        if (outstandingLoading || (!force && outstandingList.length > 0))
            return;

        setOutstandingLoading(true);
        setOutstandingError('');
        fetch('/marketing/purchase-requirement/outstanding', {
            headers: { Accept: 'application/json' },
        })
            .then((response) => {
                if (!response.ok) throw new Error('Request failed');
                return response.json();
            })
            .then((data) => {
                setOutstandingList(
                    Array.isArray(data?.purchaseRequirements)
                        ? data.purchaseRequirements
                        : [],
                );
            })
            .catch(() =>
                setOutstandingError('Gagal memuat data PR outstanding.'),
            )
            .finally(() => setOutstandingLoading(false));
    };

    const loadSisaPo = (force = false) => {
        if (sisaPoLoading || (!force && sisaPoList.length > 0)) return;

        setSisaPoLoading(true);
        setSisaPoError('');
        fetch('/marketing/purchase-requirement/sisa-po', {
            headers: { Accept: 'application/json' },
        })
            .then((response) => {
                if (!response.ok) throw new Error('Request failed');
                return response.json();
            })
            .then((data) => {
                setSisaPoList(
                    Array.isArray(data?.purchaseRequirements)
                        ? data.purchaseRequirements
                        : [],
                );
            })
            .catch(() => setSisaPoError('Gagal memuat data PR sisa PO.'))
            .finally(() => setSisaPoLoading(false));
    };

    const loadRealized = (customPeriod, force = false) => {
        const targetPeriod = customPeriod ?? periodFilter;
        if (realizedLoading) return;
        if (!force && realizedList.length > 0 && periodFilter === targetPeriod)
            return;

        setIsRealizedLoading(true);
        setRealizedLoading(true);
        setRealizedError('');

        const params = new URLSearchParams({ period: targetPeriod });
        fetch(`/marketing/purchase-requirement/realized?${params.toString()}`, {
            headers: { Accept: 'application/json' },
        })
            .then((response) => {
                if (!response.ok) throw new Error('Request failed');
                return response.json();
            })
            .then((data) => {
                const list = Array.isArray(data?.purchaseRequirements)
                    ? data.purchaseRequirements
                    : [];
                setRealizedList(list);
                setRealizedCountState(list.length);
                setRealizedTotalState(data?.realizedTotal ?? 0);
                setPeriodFilter(targetPeriod);
            })
            .catch(() => setRealizedError('Gagal memuat data PR terealisasi.'))
            .finally(() => {
                setRealizedLoading(false);
                setIsRealizedLoading(false);
            });
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [
        pageSize,
        searchTerm,
        statusFilter,
        tableDateFilter,
        tableStartDate,
        tableEndDate,
    ]);
    useEffect(() => {
        setOutstandingCurrentPage(1);
    }, [outstandingPageSize, outstandingSearchTerm]);
    useEffect(() => {
        setSisaPoCurrentPage(1);
    }, [sisaPoPageSize, sisaPoSearchTerm]);
    useEffect(() => {
        setRealizedCurrentPage(1);
    }, [realizedPageSize, realizedSearchTerm]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);
    useEffect(() => {
        if (outstandingCurrentPage > outstandingTotalPages)
            setOutstandingCurrentPage(outstandingTotalPages);
    }, [outstandingCurrentPage, outstandingTotalPages]);
    useEffect(() => {
        if (sisaPoCurrentPage > sisaPoTotalPages)
            setSisaPoCurrentPage(sisaPoTotalPages);
    }, [sisaPoCurrentPage, sisaPoTotalPages]);
    useEffect(() => {
        if (realizedCurrentPage > realizedTotalPages)
            setRealizedCurrentPage(realizedTotalPages);
    }, [realizedCurrentPage, realizedTotalPages]);
    useEffect(() => {
        if (materialCurrentPage > materialTotalPages)
            setMaterialCurrentPage(materialTotalPages);
    }, [materialCurrentPage, materialTotalPages]);

    const showToast = (message, variant = 'error') => {
        if (!message) return;
        Swal.fire({
            toast: true,
            position: 'top-end',
            timer: 3000,
            showConfirmButton: false,
            icon: variant === 'success' ? 'success' : 'error',
            title: message,
        });
    };

    const handleDelete = (noPr) => {
        if (!noPr || isDeleting) return;

        const activeEl = document.activeElement;
        if (activeEl instanceof HTMLElement) activeEl.blur();

        setIsOutstandingModalOpen(false);

        Swal.fire({
            title: 'Hapus PR?',
            text: `PR ${noPr} akan dipindahkan ke arsip lalu dihapus.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, hapus',
            cancelButtonText: 'Batal',
            reverseButtons: true,
            showLoaderOnConfirm: true,
            allowOutsideClick: () => !Swal.isLoading(),
            allowEscapeKey: () => !Swal.isLoading(),
            preConfirm: () => {
                return new Promise((resolve) => {
                    router.delete(
                        `/marketing/purchase-requirement/${encodeURIComponent(noPr)}`,
                        {
                            preserveScroll: true,
                            onStart: () => setIsDeleting(true),
                            onFinish: () => setIsDeleting(false),
                            onSuccess: (page) => resolve(page.props),
                            onError: (errors) => {
                                const firstError = Object.values(errors)[0];
                                Swal.showValidationMessage(
                                    firstError || 'Gagal menghapus data PR.',
                                );
                                resolve(false);
                            },
                        },
                    );
                });
            },
        }).then((result) => {
            if (!result.isConfirmed) return;
            setOutstandingList((prev) =>
                prev.filter((item) => item.no_pr !== noPr),
            );
            setSisaPoList((prev) => prev.filter((item) => item.no_pr !== noPr));
            setPurchaseRequirementsList((prev) =>
                prev.filter((item) => item.no_pr !== noPr),
            );
            setOutstandingCountState((prev) =>
                Math.max(0, Number(prev || 0) - 1),
            );

            router.reload({
                only: [
                    'purchaseRequirements',
                    'outstandingCount',
                    'sisaPoCount',
                    'outstandingTotal',
                    'sisaPoTotal',
                ],
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    loadOutstanding(true);
                    loadSisaPo(true);
                },
            });
            showToast('PR berhasil dihapus.', 'success');
        });
    };

    return (
        <>
            <Head title="Purchase Requirement" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">
                            Purchase Requirement
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Ringkasan dan daftar PR
                        </p>
                    </div>
                    <Button
                        type="button"
                        onClick={() =>
                            router.visit(
                                '/marketing/purchase-requirement/create',
                            )
                        }
                    >
                        Tambah PR
                    </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <button
                        type="button"
                        onClick={() => {
                            setIsOutstandingModalOpen(true);
                            loadOutstanding();
                        }}
                        className="text-left"
                    >
                        <Card className="transition hover:border-amber-500/60 hover:shadow-md">
                            <CardHeader className="pb-2">
                                <div className="mb-3 inline-flex rounded-lg bg-muted p-2">
                                    <ClipboardCheck className="size-4 text-amber-600" />
                                </div>
                                <CardDescription className="text-xs tracking-wide uppercase">
                                    PR Outstanding
                                </CardDescription>
                                <CardTitle className="text-2xl font-semibold">
                                    {summaryLoading ? (
                                        <Skeleton className="h-8 w-16" />
                                    ) : (
                                        outstandingCountState
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground">
                                    Belum ada material dibuat PO
                                </p>
                                <div className="mt-1 text-sm font-semibold">
                                    {summaryLoading ? (
                                        <Skeleton className="h-5 w-24" />
                                    ) : (
                                        formatRupiah(outstandingTotalState || 0)
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setIsSisaPoModalOpen(true);
                            loadSisaPo();
                        }}
                        className="text-left"
                    >
                        <Card className="transition hover:border-rose-500/60 hover:shadow-md">
                            <CardHeader className="pb-2">
                                <div className="mb-3 inline-flex rounded-lg bg-muted p-2">
                                    <AlertCircle className="size-4 text-rose-600" />
                                </div>
                                <CardDescription className="text-xs tracking-wide uppercase">
                                    PR Sisa PO
                                </CardDescription>
                                <CardTitle className="text-2xl font-semibold">
                                    {summaryLoading ? (
                                        <Skeleton className="h-8 w-16" />
                                    ) : (
                                        sisaPoCountState
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground">
                                    Masih ada sisa material belum dibuat PO
                                </p>
                                <div className="mt-1 text-sm font-semibold">
                                    {summaryLoading ? (
                                        <Skeleton className="h-5 w-24" />
                                    ) : (
                                        formatRupiah(sisaPoTotalState || 0)
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </button>

                    <Card className="transition hover:border-emerald-500/60 hover:shadow-md">
                        <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                    <div className="mb-3 inline-flex rounded-lg bg-muted p-2">
                                        <ShieldCheck className="size-4 text-emerald-600" />
                                    </div>
                                    <CardDescription className="text-xs tracking-wide uppercase">
                                        PR Terealisasi
                                    </CardDescription>
                                    <CardTitle className="text-2xl font-semibold">
                                        {summaryLoading || isRealizedLoading ? (
                                            <Skeleton className="h-8 w-16" />
                                        ) : (
                                            realizedCountState
                                        )}
                                    </CardTitle>
                                    <div className="mt-1 text-sm font-semibold">
                                        {summaryLoading || isRealizedLoading ? (
                                            <Skeleton className="h-5 w-24" />
                                        ) : (
                                            formatRupiah(realizedTotalState)
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <select
                                        className="h-8 rounded-md border border-sidebar-border/70 bg-background px-2 text-xs shadow-sm"
                                        value={periodFilter}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setPeriodFilter(val);
                                            loadRealized(val, true);
                                        }}
                                    >
                                        <option value="today">Hari Ini</option>
                                        <option value="this_week">
                                            Minggu Ini
                                        </option>
                                        <option value="this_month">
                                            Bulan Ini
                                        </option>
                                        <option value="this_year">
                                            Tahun Ini
                                        </option>
                                    </select>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => {
                                            setIsRealizedModalOpen(true);
                                            loadRealized(periodFilter, true);
                                        }}
                                        title="Lihat daftar PR terealisasi"
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground">
                                Semua material sudah dibuat PO
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <label className="text-sm text-muted-foreground">
                            Tampilkan
                            <select
                                className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                value={pageSize === Infinity ? 'all' : pageSize}
                                onChange={(e) =>
                                    setPageSize(
                                        e.target.value === 'all'
                                            ? Infinity
                                            : Number(e.target.value),
                                    )
                                }
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value="all">Semua</option>
                            </select>
                        </label>
                        <label className="text-sm text-muted-foreground">
                            Status
                            <select
                                className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                value={statusFilter}
                                onChange={(event) =>
                                    setStatusFilter(event.target.value)
                                }
                            >
                                <option value="all">Semua Data</option>
                                <option value="outstanding">
                                    PR Outstanding
                                </option>
                                <option value="sisa_po">PR Sisa PO</option>
                                <option value="realized">PR Terealisasi</option>
                            </select>
                        </label>
                        <label className="text-sm text-muted-foreground">
                            Tanggal
                            <select
                                className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                value={tableDateFilter}
                                onChange={(event) =>
                                    setTableDateFilter(event.target.value)
                                }
                            >
                                <option value="today">Hari Ini</option>
                                <option value="this_week">Minggu Ini</option>
                                <option value="this_month">Bulan Ini</option>
                                <option value="this_year">Tahun Ini</option>
                                <option value="range">Range Tanggal</option>
                                <option value="all">Semua Data</option>
                            </select>
                        </label>
                        {tableDateFilter === 'range' && (
                            <>
                                <label className="text-sm text-muted-foreground">
                                    Dari
                                    <input
                                        type="date"
                                        className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                        value={tableStartDate}
                                        onChange={(event) =>
                                            setTableStartDate(
                                                event.target.value,
                                            )
                                        }
                                    />
                                </label>
                                <label className="text-sm text-muted-foreground">
                                    Sampai
                                    <input
                                        type="date"
                                        className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                        value={tableEndDate}
                                        onChange={(event) =>
                                            setTableEndDate(event.target.value)
                                        }
                                    />
                                </label>
                            </>
                        )}
                    </div>
                    <label className="text-sm text-muted-foreground">
                        Cari
                        <input
                            type="search"
                            className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
                            placeholder="Cari customer, no PR, ref PO..."
                            value={searchTerm}
                            onChange={(event) =>
                                setSearchTerm(event.target.value)
                            }
                        />
                    </label>
                </div>

                <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                    <table className="w-full table-fixed text-sm">
                        <thead className="bg-muted/50 text-muted-foreground">
                            <tr>
                                <th className="w-40 px-2 py-3 text-left">
                                    No PR
                                </th>
                                <th className="w-28 px-2 py-3 text-left">
                                    Date
                                </th>
                                <th className="px-2 py-3 text-left">
                                    Customer
                                </th>
                                <th className="w-40 px-2 py-3 text-left">
                                    Ref PO
                                </th>
                                <th className="w-28 px-2 py-3 text-left">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <PlainTableStateRows
                                columns={5}
                                loading={tableLoading}
                                isEmpty={
                                    !tableLoading &&
                                    displayedPurchaseRequirements.length === 0
                                }
                                emptyMessage="Belum ada data PR."
                            />
                            {!tableLoading &&
                                displayedPurchaseRequirements.map((item) => (
                                    <tr
                                        key={item.no_pr}
                                        className="border-t border-sidebar-border/70"
                                    >
                                        <td className="px-2 py-3 whitespace-nowrap">
                                            {item.no_pr}
                                        </td>
                                        <td className="px-2 py-3 whitespace-nowrap">
                                            {item.date}
                                        </td>
                                        <td className="px-2 py-3">
                                            {renderCustomerWithOverdueMarker(
                                                item.for_customer,
                                            )}
                                        </td>
                                        <td className="px-2 py-3 align-top [overflow-wrap:anywhere] break-words whitespace-normal">
                                            {item.ref_po}
                                        </td>
                                        <td className="w-28 px-2 py-3 align-top whitespace-nowrap">
                                            <div className="flex min-w-max items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleOpenModal(item)
                                                    }
                                                    className="text-muted-foreground transition hover:text-foreground"
                                                    title="Lihat"
                                                >
                                                    <Eye className="size-4" />
                                                </button>
                                                <Link
                                                    href={`/marketing/purchase-requirement/${encodeURIComponent(item.no_pr)}/edit`}
                                                    className="text-muted-foreground transition hover:text-foreground"
                                                    title="Edit"
                                                >
                                                    <Pencil className="size-4" />
                                                </Link>
                                                <a
                                                    href={`/marketing/purchase-requirement/${encodeURIComponent(item.no_pr)}/print`}
                                                    className="text-muted-foreground transition hover:text-foreground"
                                                    title="Cetak"
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    <Printer className="size-4" />
                                                </a>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>

                {pageSize !== Infinity && totalItems > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                        <span>
                            Menampilkan{' '}
                            {Math.min(
                                (currentPage - 1) * pageSize + 1,
                                totalItems,
                            )}
                            -{Math.min(currentPage * pageSize, totalItems)} dari{' '}
                            {totalItems} data
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    setCurrentPage((page) =>
                                        Math.max(1, page - 1),
                                    )
                                }
                                disabled={currentPage === 1}
                            >
                                Sebelumnya
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                Halaman {currentPage} dari {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    setCurrentPage((page) =>
                                        Math.min(totalPages, page + 1),
                                    )
                                }
                                disabled={currentPage === totalPages}
                            >
                                Berikutnya
                            </Button>
                        </div>
                    </div>
                )}

                <Dialog
                    open={isModalOpen}
                    onOpenChange={(open) => {
                        setIsModalOpen(open);
                        if (!open) {
                            setSelectedPr(null);
                            setSelectedDetails([]);
                            setDetailError('');
                            setDetailLoading(false);
                            setMaterialPageSize(5);
                            setMaterialCurrentPage(1);
                        }
                    }}
                >
                    <DialogContent className="!top-0 !left-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-y-auto !rounded-none">
                        <DialogHeader>
                            <DialogTitle>
                                Detail Purchase Requirement
                            </DialogTitle>
                            <DialogDescription>
                                Menampilkan informasi header dan material pada
                                PR.
                            </DialogDescription>
                        </DialogHeader>

                        {!selectedPr && (
                            <p className="text-sm text-muted-foreground">
                                Data tidak tersedia.
                            </p>
                        )}

                        {selectedPr && (
                            <div className="flex flex-col gap-6 text-sm">
                                <div className="grid gap-2">
                                    <div className="grid grid-cols-[150px_1fr] gap-2">
                                        <span className="text-muted-foreground">
                                            No PR
                                        </span>
                                        <span>
                                            {renderValue(selectedPr.no_pr)}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-[150px_1fr] gap-2">
                                        <span className="text-muted-foreground">
                                            Date
                                        </span>
                                        <span>
                                            {renderValue(selectedPr.date)}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-[150px_1fr] gap-2">
                                        <span className="text-muted-foreground">
                                            Customer
                                        </span>
                                        <span>
                                            {renderValue(
                                                selectedPr.for_customer,
                                            )}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-[150px_1fr] gap-2">
                                        <span className="text-muted-foreground">
                                            Ref PO
                                        </span>
                                        <span>
                                            {renderValue(selectedPr.ref_po)}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-[150px_1fr] gap-2">
                                        <span className="text-muted-foreground">
                                            Payment Term
                                        </span>
                                        <span>
                                            {getValue(selectedPr, [
                                                'payment',
                                                'Payment',
                                                'payment_term',
                                            ]) !== '-'
                                                ? getValue(selectedPr, [
                                                      'payment',
                                                      'Payment',
                                                      'payment_term',
                                                  ])
                                                : getValue(
                                                      selectedDetails?.[0],
                                                      [
                                                          'payment',
                                                          'Payment',
                                                          'payment_term',
                                                      ],
                                                  )}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-base font-semibold">
                                        Data Material
                                    </h3>
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <label className="text-sm text-muted-foreground">
                                            Tampilkan
                                            <select
                                                className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                                value={
                                                    materialPageSize ===
                                                    Infinity
                                                        ? 'all'
                                                        : materialPageSize
                                                }
                                                onChange={(event) => {
                                                    const value =
                                                        event.target.value;
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
                                                <option value="all">
                                                    Semua
                                                </option>
                                            </select>
                                        </label>
                                        <label className="text-sm text-muted-foreground">
                                            Cari Material
                                            <input
                                                type="search"
                                                className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
                                                placeholder="Cari material..."
                                                value={materialSearchTerm}
                                                onChange={(event) =>
                                                    setMaterialSearchTerm(
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                        </label>
                                    </div>
                                    <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/50 text-muted-foreground">
                                                <tr>
                                                    <th className="w-14 px-2 py-3 text-left">
                                                        No
                                                    </th>
                                                    <th className="px-2 py-3 text-left">
                                                        Material
                                                    </th>
                                                    <th className="w-px px-2 py-3 text-left whitespace-nowrap">
                                                        Qty
                                                    </th>
                                                    <th className="w-px px-2 py-3 text-left whitespace-nowrap">
                                                        Sisa PR
                                                    </th>
                                                    <th className="px-2 py-3 text-left">
                                                        Remark
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <PlainTableStateRows
                                                    loading={detailLoading}
                                                    columns={6}
                                                    rows={5}
                                                    isEmpty={
                                                        !detailLoading &&
                                                        displayedMaterialDetails.length ===
                                                            0
                                                    }
                                                    emptyMessage={
                                                        detailError ||
                                                        'Belum ada data material.'
                                                    }
                                                />
                                                {displayedMaterialDetails.map(
                                                    (detail, index) => (
                                                        <tr
                                                            key={`${detail.no_pr}-${index}`}
                                                            className="border-t border-sidebar-border/70"
                                                        >
                                                            <td className="px-2 py-3">
                                                                {(materialPageSize ===
                                                                Infinity
                                                                    ? index
                                                                    : (materialCurrentPage -
                                                                          1) *
                                                                          materialPageSize +
                                                                      index) +
                                                                    1}
                                                            </td>
                                                            <td className="px-2 py-3">
                                                                {getValue(
                                                                    detail,
                                                                    [
                                                                        'material',
                                                                        'Material',
                                                                    ],
                                                                )}
                                                            </td>
                                                            <td className="px-2 py-3 whitespace-nowrap">
                                                                {getValue(
                                                                    detail,
                                                                    [
                                                                        'qty',
                                                                        'Qty',
                                                                        'quantity',
                                                                        'Quantity',
                                                                    ],
                                                                )}{' '}
                                                                {getValue(
                                                                    detail,
                                                                    [
                                                                        'satuan',
                                                                        'Satuan',
                                                                        'unit',
                                                                        'Unit',
                                                                    ],
                                                                )}
                                                            </td>
                                                            <td className="px-2 py-3 whitespace-nowrap">
                                                                {getValue(
                                                                    detail,
                                                                    [
                                                                        'sisa_pr',
                                                                        'Sisa_pr',
                                                                        'Sisa_PR',
                                                                    ],
                                                                )}
                                                            </td>
                                                            <td className="px-2 py-3">
                                                                {getValue(
                                                                    detail,
                                                                    [
                                                                        'renmark',
                                                                        'Renmark',
                                                                        'remark',
                                                                        'Remark',
                                                                        'keterangan',
                                                                        'Keterangan',
                                                                    ],
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ),
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    {materialPageSize !== Infinity &&
                                        materialTotalItems > 0 && (
                                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                                <span>
                                                    Menampilkan{' '}
                                                    {Math.min(
                                                        (materialCurrentPage -
                                                            1) *
                                                            materialPageSize +
                                                            1,
                                                        materialTotalItems,
                                                    )}
                                                    -
                                                    {Math.min(
                                                        materialCurrentPage *
                                                            materialPageSize,
                                                        materialTotalItems,
                                                    )}{' '}
                                                    dari {materialTotalItems}{' '}
                                                    data
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            setMaterialCurrentPage(
                                                                (page) =>
                                                                    Math.max(
                                                                        1,
                                                                        page -
                                                                            1,
                                                                    ),
                                                            )
                                                        }
                                                        disabled={
                                                            materialCurrentPage ===
                                                            1
                                                        }
                                                    >
                                                        Sebelumnya
                                                    </Button>
                                                    <span className="text-sm text-muted-foreground">
                                                        Halaman{' '}
                                                        {materialCurrentPage}{' '}
                                                        dari{' '}
                                                        {materialTotalPages}
                                                    </span>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            setMaterialCurrentPage(
                                                                (page) =>
                                                                    Math.min(
                                                                        materialTotalPages,
                                                                        page +
                                                                            1,
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
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={isOutstandingModalOpen}
                    onOpenChange={(open) => {
                        setIsOutstandingModalOpen(open);
                        if (open) {
                            loadOutstanding();
                        } else {
                            setOutstandingSearchTerm('');
                            setOutstandingPageSize(5);
                            setOutstandingCurrentPage(1);
                        }
                    }}
                >
                    <DialogContent className="!top-0 !left-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-y-auto !rounded-none">
                        <DialogHeader>
                            <DialogTitle>PR Outstanding</DialogTitle>
                            <DialogDescription>
                                Daftar PR yang belum terealisasi sama sekali
                                (belum ada material dibuat PO).
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <label>
                                Tampilkan
                                <select
                                    className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                    value={
                                        outstandingPageSize === Infinity
                                            ? 'all'
                                            : outstandingPageSize
                                    }
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setOutstandingPageSize(
                                            value === 'all'
                                                ? Infinity
                                                : Number(value),
                                        );
                                        setOutstandingCurrentPage(1);
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
                                    placeholder="Cari customer, no PR, ref PO..."
                                    value={outstandingSearchTerm}
                                    onChange={(event) =>
                                        setOutstandingSearchTerm(
                                            event.target.value,
                                        )
                                    }
                                />
                            </label>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                            <table className="w-full table-auto text-sm">
                                <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                        <th className="w-1 px-2 py-2 text-left whitespace-nowrap">
                                            No PR
                                        </th>
                                        <th className="w-1 px-2 py-2 text-left whitespace-nowrap">
                                            Date
                                        </th>
                                        <th className="w-full px-2 py-2 text-left whitespace-nowrap">
                                            Customer
                                        </th>
                                        <th className="w-1 px-2 py-2 text-left whitespace-nowrap">
                                            Ref PO
                                        </th>
                                        <th className="w-1 px-2 py-2 text-left whitespace-nowrap">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <PlainTableStateRows
                                        loading={outstandingLoading}
                                        columns={5}
                                        rows={5}
                                        isEmpty={
                                            !outstandingLoading &&
                                            displayedOutstandingPurchaseRequirements.length ===
                                                0
                                        }
                                        emptyMessage={
                                            outstandingError ||
                                            'Tidak ada PR outstanding.'
                                        }
                                    />
                                    {displayedOutstandingPurchaseRequirements.map(
                                        (item) => (
                                            <tr
                                                key={`outstanding-${item.no_pr}`}
                                                className="border-t border-sidebar-border/70"
                                            >
                                                <td className="w-1 px-2 py-2 whitespace-nowrap">
                                                    {item.no_pr}
                                                </td>
                                                <td className="w-1 px-2 py-2 whitespace-nowrap">
                                                    {item.date}
                                                </td>
                                                <td className="w-full min-w-0 px-2 py-2 whitespace-nowrap">
                                                    <div className="min-w-0">
                                                        {renderCustomerWithOverdueMarker(
                                                            item.for_customer,
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="w-1 px-2 py-2 whitespace-nowrap">
                                                    {item.ref_po}
                                                </td>
                                                <td className="w-1 px-2 py-2 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setIsOutstandingModalOpen(
                                                                    false,
                                                                );
                                                                handleOpenModal(
                                                                    item,
                                                                );
                                                            }}
                                                            className="text-muted-foreground transition hover:text-foreground"
                                                            title="Lihat"
                                                        >
                                                            <Eye className="size-4" />
                                                        </button>
                                                        <Link
                                                            href={`/marketing/purchase-requirement/${encodeURIComponent(item.no_pr)}/edit`}
                                                            className="text-muted-foreground transition hover:text-foreground"
                                                            title="Edit"
                                                        >
                                                            <Pencil className="size-4" />
                                                        </Link>
                                                        {item._canDelete && (
                                                            <button
                                                                type="button"
                                                                className="text-muted-foreground transition hover:text-destructive"
                                                                title="Hapus"
                                                                disabled={
                                                                    isDeleting
                                                                }
                                                                onClick={() =>
                                                                    handleDelete(
                                                                        item.no_pr,
                                                                    )
                                                                }
                                                            >
                                                                <Trash2 className="size-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {outstandingPageSize !== Infinity &&
                            outstandingTotalItems > 0 && (
                                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                    <span>
                                        Menampilkan{' '}
                                        {Math.min(
                                            (outstandingCurrentPage - 1) *
                                                outstandingPageSize +
                                                1,
                                            outstandingTotalItems,
                                        )}
                                        -
                                        {Math.min(
                                            outstandingCurrentPage *
                                                outstandingPageSize,
                                            outstandingTotalItems,
                                        )}{' '}
                                        dari {outstandingTotalItems} data
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setOutstandingCurrentPage(
                                                    (page) =>
                                                        Math.max(1, page - 1),
                                                )
                                            }
                                            disabled={
                                                outstandingCurrentPage === 1
                                            }
                                        >
                                            Sebelumnya
                                        </Button>
                                        <span className="text-sm text-muted-foreground">
                                            Halaman {outstandingCurrentPage}{' '}
                                            dari {outstandingTotalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setOutstandingCurrentPage(
                                                    (page) =>
                                                        Math.min(
                                                            outstandingTotalPages,
                                                            page + 1,
                                                        ),
                                                )
                                            }
                                            disabled={
                                                outstandingCurrentPage ===
                                                outstandingTotalPages
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
                    open={isSisaPoModalOpen}
                    onOpenChange={(open) => {
                        setIsSisaPoModalOpen(open);
                        if (open) {
                            loadSisaPo();
                        } else {
                            setSisaPoSearchTerm('');
                            setSisaPoPageSize(5);
                            setSisaPoCurrentPage(1);
                        }
                    }}
                >
                    <DialogContent className="!top-0 !left-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-y-auto !rounded-none">
                        <DialogHeader>
                            <DialogTitle>PR Sisa PO</DialogTitle>
                            <DialogDescription>
                                Daftar PR yang sudah mulai dibuat PO namun masih
                                memiliki sisa material.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <label>
                                Tampilkan
                                <select
                                    className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                    value={
                                        sisaPoPageSize === Infinity
                                            ? 'all'
                                            : sisaPoPageSize
                                    }
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setSisaPoPageSize(
                                            value === 'all'
                                                ? Infinity
                                                : Number(value),
                                        );
                                        setSisaPoCurrentPage(1);
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
                                    placeholder="Cari customer, no PR, ref PO..."
                                    value={sisaPoSearchTerm}
                                    onChange={(event) =>
                                        setSisaPoSearchTerm(event.target.value)
                                    }
                                />
                            </label>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                            <table className="w-full table-auto text-sm">
                                <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                        <th className="w-1 px-2 py-2 text-left whitespace-nowrap">
                                            No PR
                                        </th>
                                        <th className="w-1 px-2 py-2 text-left whitespace-nowrap">
                                            Date
                                        </th>
                                        <th className="w-full px-2 py-2 text-left whitespace-nowrap">
                                            Customer
                                        </th>
                                        <th className="w-1 px-2 py-2 text-left whitespace-nowrap">
                                            Ref PO
                                        </th>
                                        <th className="w-1 px-2 py-2 text-left whitespace-nowrap">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <PlainTableStateRows
                                        loading={sisaPoLoading}
                                        columns={5}
                                        rows={5}
                                        isEmpty={
                                            !sisaPoLoading &&
                                            displayedSisaPoPurchaseRequirements.length ===
                                                0
                                        }
                                        emptyMessage={
                                            sisaPoError ||
                                            'Tidak ada PR sisa PO.'
                                        }
                                    />
                                    {displayedSisaPoPurchaseRequirements.map(
                                        (item) => (
                                            <tr
                                                key={`sisa-po-${item.no_pr}`}
                                                className="border-t border-sidebar-border/70"
                                            >
                                                <td className="w-1 px-2 py-2 whitespace-nowrap">
                                                    {item.no_pr}
                                                </td>
                                                <td className="w-1 px-2 py-2 whitespace-nowrap">
                                                    {item.date}
                                                </td>
                                                <td className="w-full min-w-0 px-2 py-2 whitespace-nowrap">
                                                    <div className="min-w-0">
                                                        {renderCustomerWithOverdueMarker(
                                                            item.for_customer,
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="w-1 px-2 py-2 whitespace-nowrap">
                                                    {item.ref_po}
                                                </td>
                                                <td className="w-1 px-2 py-2 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setIsSisaPoModalOpen(
                                                                    false,
                                                                );
                                                                handleOpenModal(
                                                                    item,
                                                                );
                                                            }}
                                                            className="text-muted-foreground transition hover:text-foreground"
                                                            title="Lihat"
                                                        >
                                                            <Eye className="size-4" />
                                                        </button>
                                                        <Link
                                                            href={`/marketing/purchase-requirement/${encodeURIComponent(item.no_pr)}/edit`}
                                                            className="text-muted-foreground transition hover:text-foreground"
                                                            title="Edit"
                                                        >
                                                            <Pencil className="size-4" />
                                                        </Link>
                                                        {item._canDelete && (
                                                            <button
                                                                type="button"
                                                                className="text-muted-foreground transition hover:text-destructive"
                                                                title="Hapus"
                                                                disabled={
                                                                    isDeleting
                                                                }
                                                                onClick={() =>
                                                                    handleDelete(
                                                                        item.no_pr,
                                                                    )
                                                                }
                                                            >
                                                                <Trash2 className="size-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {sisaPoPageSize !== Infinity &&
                            sisaPoTotalItems > 0 && (
                                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                    <span>
                                        Menampilkan{' '}
                                        {Math.min(
                                            (sisaPoCurrentPage - 1) *
                                                sisaPoPageSize +
                                                1,
                                            sisaPoTotalItems,
                                        )}
                                        -
                                        {Math.min(
                                            sisaPoCurrentPage * sisaPoPageSize,
                                            sisaPoTotalItems,
                                        )}{' '}
                                        dari {sisaPoTotalItems} data
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setSisaPoCurrentPage((page) =>
                                                    Math.max(1, page - 1),
                                                )
                                            }
                                            disabled={sisaPoCurrentPage === 1}
                                        >
                                            Sebelumnya
                                        </Button>
                                        <span className="text-sm text-muted-foreground">
                                            Halaman {sisaPoCurrentPage} dari{' '}
                                            {sisaPoTotalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setSisaPoCurrentPage((page) =>
                                                    Math.min(
                                                        sisaPoTotalPages,
                                                        page + 1,
                                                    ),
                                                )
                                            }
                                            disabled={
                                                sisaPoCurrentPage ===
                                                sisaPoTotalPages
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
                    open={isRealizedModalOpen}
                    onOpenChange={(open) => {
                        setIsRealizedModalOpen(open);
                        if (open) {
                            loadRealized(periodFilter, true);
                        } else {
                            setRealizedSearchTerm('');
                            setRealizedPageSize(5);
                            setRealizedCurrentPage(1);
                        }
                    }}
                >
                    <DialogContent className="!top-0 !left-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-y-auto !rounded-none">
                        <DialogHeader>
                            <DialogTitle>PR Terealisasi</DialogTitle>
                            <DialogDescription>
                                Daftar PR yang sudah terealisasi sesuai periode
                                terpilih.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <label>
                                Tampilkan
                                <select
                                    className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                    value={
                                        realizedPageSize === Infinity
                                            ? 'all'
                                            : realizedPageSize
                                    }
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setRealizedPageSize(
                                            value === 'all'
                                                ? Infinity
                                                : Number(value),
                                        );
                                        setRealizedCurrentPage(1);
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
                                    placeholder="Cari no PR, customer, ref PO..."
                                    value={realizedSearchTerm}
                                    onChange={(event) =>
                                        setRealizedSearchTerm(
                                            event.target.value,
                                        )
                                    }
                                />
                            </label>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                            <table className="w-full table-auto text-sm">
                                <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                        <th className="w-1 px-2 py-2 text-left whitespace-nowrap">
                                            No PR
                                        </th>
                                        <th className="w-1 px-2 py-2 text-left whitespace-nowrap">
                                            Date
                                        </th>
                                        <th className="w-full px-2 py-2 text-left whitespace-nowrap">
                                            Customer
                                        </th>
                                        <th className="w-1 px-2 py-2 text-left whitespace-nowrap">
                                            Ref PO
                                        </th>
                                        <th className="w-1 px-2 py-2 text-left whitespace-nowrap">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <PlainTableStateRows
                                        loading={realizedLoading}
                                        columns={5}
                                        rows={5}
                                        isEmpty={
                                            !realizedLoading &&
                                            displayedRealizedPurchaseRequirements.length ===
                                                0
                                        }
                                        emptyMessage={
                                            realizedError ||
                                            'Tidak ada PR terealisasi.'
                                        }
                                    />
                                    {displayedRealizedPurchaseRequirements.map(
                                        (item) => (
                                            <tr
                                                key={`realized-${item.no_pr}`}
                                                className="border-t border-sidebar-border/70"
                                            >
                                                <td className="w-1 px-2 py-2 whitespace-nowrap">
                                                    {item.no_pr}
                                                </td>
                                                <td className="w-1 px-2 py-2 whitespace-nowrap">
                                                    {getValue(item, [
                                                        'date',
                                                        'tgl',
                                                    ])}
                                                </td>
                                                <td className="w-full min-w-0 px-2 py-2 whitespace-nowrap">
                                                    <div className="min-w-0">
                                                        {renderCustomerWithOverdueMarker(
                                                            getValue(item, [
                                                                'for_customer',
                                                            ]),
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="w-1 px-2 py-2 whitespace-nowrap">
                                                    {item.ref_po}
                                                </td>
                                                <td className="w-1 px-2 py-2 whitespace-nowrap">
                                                    <button
                                                        type="button"
                                                        className="text-muted-foreground transition hover:text-foreground"
                                                        title="Lihat"
                                                        onClick={() => {
                                                            setIsRealizedModalOpen(
                                                                false,
                                                            );
                                                            handleOpenModal(
                                                                item,
                                                            );
                                                        }}
                                                    >
                                                        <Eye className="size-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {realizedPageSize !== Infinity &&
                            realizedTotalItems > 0 && (
                                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                    <span>
                                        Menampilkan{' '}
                                        {Math.min(
                                            (realizedCurrentPage - 1) *
                                                realizedPageSize +
                                                1,
                                            realizedTotalItems,
                                        )}
                                        -
                                        {Math.min(
                                            realizedCurrentPage *
                                                realizedPageSize,
                                            realizedTotalItems,
                                        )}{' '}
                                        dari {realizedTotalItems} data
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setRealizedCurrentPage((page) =>
                                                    Math.max(1, page - 1),
                                                )
                                            }
                                            disabled={realizedCurrentPage === 1}
                                        >
                                            Sebelumnya
                                        </Button>
                                        <span className="text-sm text-muted-foreground">
                                            Halaman {realizedCurrentPage} from{' '}
                                            {realizedTotalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setRealizedCurrentPage((page) =>
                                                    Math.min(
                                                        realizedTotalPages,
                                                        page + 1,
                                                    ),
                                                )
                                            }
                                            disabled={
                                                realizedCurrentPage ===
                                                realizedTotalPages
                                            }
                                        >
                                            Berikutnya
                                        </Button>
                                    </div>
                                </div>
                            )}
                    </DialogContent>
                </Dialog>
                <OverdueInvoiceWarningDialog
                    open={overdueDialogOpen}
                    onOpenChange={setOverdueDialogOpen}
                    data={overdueDialogData}
                    onInvoiceClick={(invoice) => {
                        setSelectedInvoiceNo(invoice.no_fakturpenjualan);
                        setInvoiceDetailOpen(true);
                    }}
                    showActions={false}
                    title="Tunggakan Tagihan Customer"
                    description={
                        overdueDialogLoading
                            ? 'Memuat data tunggakan tagihan customer...'
                            : 'Daftar tagihan customer yang sudah melewati jatuh tempo.'
                    }
                />
                <InvoiceDetailDialog
                    open={invoiceDetailOpen}
                    onOpenChange={setInvoiceDetailOpen}
                    invoiceNo={selectedInvoiceNo}
                />
            </div>
        </>
    );
}

PurchaseRequirementIndex.layout = (page) => (
    <AppLayout children={page} breadcrumbs={breadcrumbs} />
);
