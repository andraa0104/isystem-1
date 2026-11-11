import { MenuAction } from '@/components/menu-action';
import { PlainTableStateRows } from '@/components/data-states/TableStateRows';
import { FormattedRemark } from '@/components/rich-text-editor';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { subscribeToPoInChanges } from '@/lib/po-in-realtime';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowRight,
    Boxes,
    Building2,
    Calendar,
    Check,
    ChevronLeft,
    ChevronRight,
    Eye,
    FileSpreadsheet,
    FileText,
    Filter,
    Layers,
    Mail,
    MapPin,
    Package,
    Pencil,
    Phone,
    Plus,
    Printer,
    RefreshCw,
    Search,
    Trash2,
    UserCheck,
    Users,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/quotation' },
    { title: 'Quotation', href: '/marketing/quotation' },
];

const periodLabels = {
    today: 'Hari Ini',
    week: 'Minggu Ini',
    month: 'Bulan Ini',
    year: 'Tahun Ini',
    all: 'Semua Periode',
};

const formatNumber = (value) => {
    const number = Number(value);
    if (Number.isNaN(number)) {
        return '-';
    }
    return new Intl.NumberFormat('id-ID').format(number);
};

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const formatPercent = (value) => {
    if (value === null || value === undefined || value === '' || value === '-') {
        return '-';
    }
    const normalized = String(value).replace(/%/g, '').trim();
    return normalized === '' || normalized === '-' ? '-' : `${normalized}%`;
};

const isValidNote = (value) => {
    if (value === null || value === undefined) return false;
    const text = String(value).trim();
    return text !== '' && text !== '-' && text !== '--' && text !== '—';
};

export default function QuotationIndex({
    penawaran = [],
    penawaranDetail = [],
    detailNo = null,
    period = 'today',
    realtimeChannel = null,
}) {
    const { flash = {} } = usePage().props;
    const [toast, setToast] = useState(null);

    useEffect(() => {
        try {
            const raw = window.sessionStorage.getItem('quotation_flash_success');
            if (raw) {
                window.sessionStorage.removeItem('quotation_flash_success');
                const parsed = JSON.parse(raw);
                setToast({
                    type: 'success',
                    title: parsed.title || 'Quotation Berhasil Disimpan!',
                    message: parsed.message || 'Data quotation berhasil disimpan.',
                    noPenawaran: parsed.noPenawaran || '',
                    duration: 4500,
                });
                return;
            }
        } catch (e) {
            console.error('Error reading quotation_flash_success', e);
        }

        if (flash?.success) {
            setToast({
                type: 'success',
                title: 'Berhasil!',
                message: flash.success,
                duration: 4500,
            });
        } else if (flash?.error) {
            setToast({
                type: 'error',
                title: 'Gagal!',
                message: flash.error,
                duration: 6000,
            });
        }
    }, [flash?.success, flash?.error]);

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => {
            setToast(null);
        }, toast.duration || 4500);
        return () => clearTimeout(timer);
    }, [toast]);

    // ─── State Tab 1 (Customer) ──────────────────────────────────────────
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState(period);
    const [remotePenawaran, setRemotePenawaran] = useState(penawaran);
    const [totalItems, setTotalItems] = useState(penawaran.length);
    const [loading, setLoading] = useState(false);

    // ─── State Modal & Detail ────────────────────────────────────────────
    const [selectedPenawaran, setSelectedPenawaran] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [detailRows, setDetailRows] = useState([]);
    const [detailRowsNo, setDetailRowsNo] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [materialSearchTerm, setMaterialSearchTerm] = useState('');
    const [modalMaterialPageSize, setModalMaterialPageSize] = useState(5);
    const [modalMaterialCurrentPage, setModalMaterialCurrentPage] = useState(1);
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Ya, Lanjut',
        cancelText: 'Batal',
        variant: 'warning',
        onConfirm: null,
    });

    // ─── State Navigasi Tab Utama ────────────────────────────────────────
    const [activeTab, setActiveTab] = useState('customer');

    // ─── State Tab 2 (Material) ──────────────────────────────────────────
    const [materialSearch, setMaterialSearch] = useState('');
    const [debouncedMaterialSearch, setDebouncedMaterialSearch] = useState('');
    const [materialPageSize, setMaterialPageSize] = useState(10);
    const [materialCurrentPage, setMaterialCurrentPage] = useState(1);
    const [materialLoading, setMaterialLoading] = useState(false);
    const [remoteMaterialDetails, setRemoteMaterialDetails] = useState([]);
    const [materialTotal, setMaterialTotal] = useState(0);
    const [realtimeRevision, setRealtimeRevision] = useState(0);

    // ─── Realtime Listener ───────────────────────────────────────────────
    useEffect(() => {
        let timer;
        const unsubscribe = subscribeToPoInChanges(
            realtimeChannel,
            () => {
                if (timer) return;
                timer = setTimeout(() => {
                    timer = null;
                    setRealtimeRevision((revision) => revision + 1);
                }, 200);
            },
            'quotation.changed'
        );
        return () => {
            clearTimeout(timer);
            unsubscribe();
        };
    }, [realtimeChannel]);

    // ─── Fetch Data Tab 1 (Customer) ─────────────────────────────────────
    const fetchQuotationData = useCallback(
        async (newPeriod, search, page, perPage, signal) => {
            setLoading(true);
            try {
                const params = new URLSearchParams({
                    period: newPeriod,
                    search,
                    page: String(page),
                    per_page: perPage === Infinity ? 'all' : String(perPage),
                });
                const resPenawaran = await fetch(`/marketing/quotation/data?${params.toString()}`, {
                    headers: { Accept: 'application/json' },
                    signal,
                });
                if (!resPenawaran.ok) throw new Error('Gagal memuat quotation.');
                const dataPenawaran = await resPenawaran.json();
                if (signal?.aborted) return;
                setRemotePenawaran(dataPenawaran.penawaran || []);
                setTotalItems(Number(dataPenawaran.total || 0));
            } catch (error) {
                if (!signal?.aborted) console.error('Error fetching data:', error);
            } finally {
                if (!signal?.aborted) setLoading(false);
            }
        },
        []
    );

    // ─── Fetch Data Tab 2 (Material) ─────────────────────────────────────
    const fetchMaterialData = useCallback(async (page, perPage, search, signal) => {
        setMaterialLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                per_page: perPage === Infinity ? 'all' : String(perPage),
                search: search,
            });
            const resMaterial = await fetch(`/marketing/quotation/materials-data?${params.toString()}`, {
                headers: { Accept: 'application/json' },
                signal,
            });
            if (!resMaterial.ok) throw new Error('Gagal memuat material quotation.');
            const dataMaterial = await resMaterial.json();
            if (signal?.aborted) return;
            setRemoteMaterialDetails(dataMaterial.materials || []);
            setMaterialTotal(dataMaterial.total || 0);
        } catch (error) {
            if (signal?.aborted) return;
            console.error('Error fetching material data:', error);
            setRemoteMaterialDetails([]);
            setMaterialTotal(0);
        } finally {
            if (!signal?.aborted) setMaterialLoading(false);
        }
    }, []);

    useEffect(() => {
        setRemotePenawaran(penawaran);
    }, [penawaran]);

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearchTerm(searchTerm.trim()), 350);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    useEffect(() => {
        if (activeTab !== 'customer') return;
        const controller = new AbortController();
        fetchQuotationData(statusFilter, debouncedSearchTerm, currentPage, pageSize, controller.signal);
        return () => controller.abort();
    }, [activeTab, statusFilter, debouncedSearchTerm, currentPage, pageSize, fetchQuotationData, realtimeRevision]);

    const handlePeriodChange = (newPeriod) => {
        setStatusFilter(newPeriod);
        setCurrentPage(1);
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
    };

    // ─── Pagination Tab 1 (Customer) ─────────────────────────────────────
    const totalPages = useMemo(() => {
        if (pageSize === Infinity) return 1;
        return Math.max(1, Math.ceil(totalItems / pageSize));
    }, [pageSize, totalItems]);

    const displayedPenawaran = remotePenawaran;

    const handlePageSizeChange = (event) => {
        const value = event.target.value;
        setPageSize(value === 'all' ? Infinity : Number(value));
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [pageSize, searchTerm]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    // ─── Pagination Tab 2 (Material) ─────────────────────────────────────
    const tab2TotalPages = useMemo(() => {
        if (materialPageSize === Infinity) return 1;
        return Math.max(1, Math.ceil(materialTotal / materialPageSize));
    }, [materialPageSize, materialTotal]);

    const handleMaterialPageSizeChange = (event) => {
        const value = event.target.value;
        setMaterialPageSize(value === 'all' ? Infinity : Number(value));
    };

    useEffect(() => {
        setMaterialCurrentPage(1);
    }, [materialPageSize, materialSearch]);

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedMaterialSearch(materialSearch.trim()), 350);
        return () => clearTimeout(handler);
    }, [materialSearch]);

    useEffect(() => {
        if (activeTab !== 'material') return;
        const controller = new AbortController();
        fetchMaterialData(materialCurrentPage, materialPageSize, debouncedMaterialSearch, controller.signal);
        return () => controller.abort();
    }, [activeTab, materialCurrentPage, materialPageSize, debouncedMaterialSearch, fetchMaterialData, realtimeRevision]);

    useEffect(() => {
        if (materialCurrentPage > tab2TotalPages) {
            setMaterialCurrentPage(tab2TotalPages);
        }
    }, [materialCurrentPage, tab2TotalPages]);

    // ─── Modal Detail Handlers ───────────────────────────────────────────
    const handleOpenModal = (item) => {
        const noPenawaran = item.No_penawaran || item.No_Penawaran;
        if (!noPenawaran) return;

        setDetailLoading(true);
        setIsModalOpen(true);
        setDetailRows([]);
        setDetailRowsNo(null);
        setSelectedPenawaran({ ...item, No_penawaran: noPenawaran });
    };

    const selectedQuotationNo = selectedPenawaran?.No_penawaran;

    useEffect(() => {
        if (!isModalOpen || !selectedQuotationNo) return;
        const controller = new AbortController();
        const load = async () => {
            setDetailLoading(true);
            try {
                const base = `/marketing/quotation/${encodeURIComponent(selectedQuotationNo)}`;
                const options = { headers: { Accept: 'application/json' }, signal: controller.signal };
                const [headerResponse, detailResponse] = await Promise.all([
                    fetch(`${base}/header`, options),
                    fetch(`${base}/details`, options),
                ]);
                if (controller.signal.aborted) return;
                if (headerResponse.status === 404) {
                    setIsModalOpen(false);
                    setSelectedPenawaran(null);
                    return;
                }
                if (!headerResponse.ok || !detailResponse.ok) throw new Error('Gagal memuat detail quotation.');
                const [header, details] = await Promise.all([headerResponse.json(), detailResponse.json()]);
                if (controller.signal.aborted) return;
                setSelectedPenawaran({
                    ...header,
                    No_penawaran: header.No_penawaran || selectedQuotationNo,
                    Tgl_Penawaran: header.Tgl_Penawaran || header.Tgl_penawaran || '-',
                });
                setDetailRows(Array.isArray(details.details) ? details.details : []);
                setDetailRowsNo(selectedQuotationNo);
            } catch (error) {
                if (!controller.signal.aborted) console.error('Error fetching quotation details:', error);
            } finally {
                if (!controller.signal.aborted) setDetailLoading(false);
            }
        };
        void load();
        return () => controller.abort();
    }, [isModalOpen, selectedQuotationNo, realtimeRevision]);

    const selectedDetails = useMemo(() => {
        if (!selectedPenawaran) return [];
        const selectedNo = String(selectedPenawaran.No_penawaran ?? '').trim();
        if (String(detailRowsNo ?? '').trim() === selectedNo && detailRows.length > 0) return detailRows;
        return [];
    }, [detailRows, detailRowsNo, selectedPenawaran]);

    const filteredMaterialDetails = useMemo(() => {
        const term = materialSearchTerm.trim().toLowerCase();
        if (!term) return selectedDetails;
        return selectedDetails.filter((detail) => {
            const values = [
                detail.Material,
                detail.Qty,
                detail.Harga,
                detail.Satuan,
                detail.Harga_modal,
                detail.Margin,
                detail.Remark,
            ];
            return values.some((value) => String(value ?? '').toLowerCase().includes(term));
        });
    }, [materialSearchTerm, selectedDetails]);

    const materialModalTotalItems = filteredMaterialDetails.length;
    const materialModalTotalPages = useMemo(() => {
        if (modalMaterialPageSize === Infinity) return 1;
        return Math.max(1, Math.ceil(materialModalTotalItems / modalMaterialPageSize));
    }, [modalMaterialPageSize, materialModalTotalItems]);

    const displayedMaterialDetails = useMemo(() => {
        if (modalMaterialPageSize === Infinity) return filteredMaterialDetails;
        const startIndex = (modalMaterialCurrentPage - 1) * modalMaterialPageSize;
        return filteredMaterialDetails.slice(startIndex, startIndex + modalMaterialPageSize);
    }, [filteredMaterialDetails, modalMaterialCurrentPage, modalMaterialPageSize]);

    useEffect(() => {
        setModalMaterialCurrentPage(1);
    }, [materialSearchTerm, modalMaterialPageSize]);

    useEffect(() => {
        if (modalMaterialCurrentPage > materialModalTotalPages) {
            setModalMaterialCurrentPage(materialModalTotalPages);
        }
    }, [modalMaterialCurrentPage, materialModalTotalPages]);

    useEffect(() => {
        if (isModalOpen) {
            setMaterialSearchTerm('');
            setModalMaterialPageSize(5);
            setModalMaterialCurrentPage(1);
        } else {
            setDetailRows([]);
            setDetailRowsNo(null);
            setDetailLoading(false);
        }
    }, [isModalOpen, selectedQuotationNo]);

    const handleDelete = (noPenawaran) => {
        if (!noPenawaran || isDeleting) return;

        setConfirmModal({
            isOpen: true,
            title: 'Hapus Dokumen Penawaran',
            message: `Apakah Anda yakin ingin menghapus data penawaran "${noPenawaran}"? Tindakan ini tidak dapat dibatalkan.`,
            confirmText: 'Ya, Hapus',
            cancelText: 'Batal',
            variant: 'danger',
            onConfirm: () => {
                setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                setIsDeleting(true);

                fetch(`/marketing/quotation/${encodeURIComponent(noPenawaran)}`, {
                    method: 'DELETE',
                    headers: {
                        Accept: 'application/json',
                        'X-CSRF-TOKEN':
                            document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
                    },
                })
                    .then(async (response) => {
                        const data = await response.json().catch(() => ({}));
                        if (!response.ok) {
                            throw new Error(data?.message || 'Gagal menghapus data.');
                        }
                        return data;
                    })
                    .then((data) => {
                        setToast({
                            type: 'success',
                            title: 'Berhasil Dihapus',
                            message: data?.message || `Data quotation ${noPenawaran} berhasil dihapus.`,
                            noPenawaran,
                            duration: 4000,
                        });
                        setRealtimeRevision((revision) => revision + 1);
                    })
                    .catch((error) => {
                        setToast({
                            type: 'error',
                            title: 'Gagal Menghapus Data',
                            message: error.message || 'Terjadi kesalahan sistem saat menghapus quotation.',
                            duration: 6000,
                        });
                    })
                    .finally(() => setIsDeleting(false));
            },
        });
    };

    return (
        <>
            <Head title="Marketing • Quotation" />

            <div className="relative flex min-h-screen min-h-full flex-1 flex-col gap-5 p-4 sm:p-6 w-full">
                {/* ─── 1. Header Banner & Executive Stat Ribbon ────────────── */}
                <div className="relative overflow-hidden rounded-2xl border border-sidebar-border/70 bg-card p-5 sm:p-6 shadow-xs">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xs">
                                <FileSpreadsheet className="size-6" />
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                                    Marketing Quotation
                                </h1>
                                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                                    Kelola daftar penawaran harga kepada customer secara terintegrasi dan realtime.
                                </p>
                            </div>
                        </div>

                        {/* Top Action & Create Button */}
                        <div className="flex items-center gap-2.5 shrink-0">
                            <MenuAction
                                action="create"
                                type="button"
                                as={Button}
                                onClick={() => router.visit('/marketing/quotation/create')}
                                className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs gap-1.5 shadow-xs cursor-pointer h-9 px-4 transition-colors"
                            >
                                <Plus className="size-4" />
                                <span>Tambah Quotation</span>
                            </MenuAction>
                        </div>
                    </div>
                </div>

                {/* ─── 2. Clean Segmented Tabs (Ringan & Cepat) ─────────── */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="inline-flex rounded-xl bg-muted/60 p-1 border border-sidebar-border/60 shadow-xs">
                        <button
                            type="button"
                            onClick={() => handleTabChange('customer')}
                            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer select-none ${
                                activeTab === 'customer'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                            }`}
                        >
                            <Building2 className="size-3.5" />
                            <span>Data Quotation Customer</span>
                            <span
                                className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums tracking-wide ${
                                    activeTab === 'customer'
                                        ? 'bg-white/20 text-white'
                                        : 'bg-background/80 text-muted-foreground'
                                }`}
                            >
                                {totalItems}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleTabChange('material')}
                            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer select-none ${
                                activeTab === 'material'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                            }`}
                        >
                            <Boxes className="size-3.5" />
                            <span>Data Quotation Material</span>
                            <span
                                className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums tracking-wide ${
                                    activeTab === 'material'
                                        ? 'bg-white/20 text-white'
                                        : 'bg-background/80 text-muted-foreground'
                                }`}
                            >
                                {materialTotal}
                            </span>
                        </button>
                    </div>
                </div>

                {/* ─── 3. Content Panel (Conditional Rendering Cepat) ───────── */}
                {activeTab === 'customer' ? (
                    <div className="flex flex-col gap-4">
                        {/* Filter & Search Bar */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 sm:p-4 rounded-xl border border-sidebar-border/70 bg-card shadow-xs">
                            <div className="flex flex-wrap items-center gap-2.5">
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-semibold">
                                    <Filter className="size-4 text-emerald-600" />
                                    <span>Filter:</span>
                                </div>

                                {/* Period Dropdown */}
                                <Select value={statusFilter} onValueChange={handlePeriodChange}>
                                    <SelectTrigger className="w-[160px] h-9 rounded-xl border-sidebar-border/80 bg-background text-sm font-semibold focus:ring-emerald-500/20">
                                        <SelectValue placeholder="Pilih Periode" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-sidebar-border/70 bg-card shadow-md text-sm font-semibold">
                                        <SelectItem value="today">Hari Ini</SelectItem>
                                        <SelectItem value="week">Minggu Ini</SelectItem>
                                        <SelectItem value="month">Bulan Ini</SelectItem>
                                        <SelectItem value="year">Tahun Ini</SelectItem>
                                        <SelectItem value="all">Semua Periode</SelectItem>
                                    </SelectContent>
                                </Select>

                                {/* Page size dropdown */}
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-semibold">
                                    <span className="hidden sm:inline">Baris:</span>
                                    <select
                                        className="h-9 rounded-xl border border-sidebar-border/80 bg-background px-2.5 text-sm font-semibold text-foreground focus:outline-hidden cursor-pointer"
                                        value={pageSize === Infinity ? 'all' : pageSize}
                                        onChange={handlePageSizeChange}
                                    >
                                        <option value={5}>5 Baris</option>
                                        <option value={10}>10 Baris</option>
                                        <option value={25}>25 Baris</option>
                                        <option value={50}>50 Baris</option>
                                        <option value="all">Semua</option>
                                    </select>
                                </div>
                            </div>

                            {/* Search Bar with Instant Clear */}
                            <div className="relative w-full md:w-80">
                                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground/60" />
                                <input
                                    type="search"
                                    className="h-9 w-full rounded-xl border border-sidebar-border/80 bg-background pl-9 pr-8 text-sm font-medium placeholder:text-muted-foreground/60 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 transition-colors"
                                    placeholder="Cari No Penawaran, Customer..."
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                                    >
                                        <X className="size-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Table Card */}
                        <div className="overflow-hidden rounded-xl border border-sidebar-border/70 bg-card shadow-xs">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead>
                                        <tr className="border-b border-sidebar-border/60 bg-muted/40 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                            <th className="py-3.5 px-4 w-44 whitespace-nowrap">No Doc</th>
                                            <th className="py-3.5 px-4 w-36 whitespace-nowrap">Tanggal</th>
                                            <th className="py-3.5 px-4 min-w-[220px]">Customer</th>
                                            <th className="py-3.5 px-4 w-44 whitespace-nowrap">Attend</th>
                                            <th className="py-3.5 px-4 w-28 text-center whitespace-nowrap">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-sidebar-border/40">
                                        <PlainTableStateRows
                                            columns={5}
                                            loading={loading}
                                            isEmpty={!loading && displayedPenawaran.length === 0}
                                            emptyTitle="Tidak ada data quotation"
                                            emptyDescription="Belum ada penawaran customer pada periode ini atau kata kunci pencarian Anda."
                                        />
                                        {!loading &&
                                            displayedPenawaran.map((item, idx) => (
                                                <tr
                                                    key={item.No_penawaran || idx}
                                                    className="hover:bg-muted/40 transition-colors group"
                                                >
                                                    <td className="py-3.5 px-4 whitespace-nowrap">
                                                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 tracking-wide tabular-nums">
                                                            <FileText className="size-3.5" />
                                                            <span>{item.No_penawaran}</span>
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-sm font-semibold text-muted-foreground whitespace-nowrap tracking-wide tabular-nums">
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <Calendar className="size-3.5 text-muted-foreground/60" />
                                                            <span>{item.Tgl_Posting || '-'}</span>
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-4 min-w-[220px]">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:text-emerald-600 transition-colors">
                                                                <Building2 className="size-3.5" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div
                                                                    className="font-semibold text-foreground truncate text-sm"
                                                                    title={item.Customer}
                                                                >
                                                                    {item.Customer || '-'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-4 whitespace-nowrap">
                                                        <span className="inline-flex items-center gap-1.5 text-sm text-foreground/80 font-semibold">
                                                            <UserCheck className="size-3.5 text-muted-foreground/60" />
                                                            <span>{item.Attend || '-'}</span>
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-4 whitespace-nowrap">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenModal(item)}
                                                                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/15 transition-all cursor-pointer"
                                                                title="Lihat Detail Penawaran"
                                                            >
                                                                <Eye className="size-4" />
                                                            </button>

                                                            <MenuAction
                                                                action="update"
                                                                as={Link}
                                                                href={`/marketing/quotation/${encodeURIComponent(item.No_penawaran)}/edit`}
                                                                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-indigo-600 hover:bg-indigo-500/15 transition-all cursor-pointer"
                                                                title="Edit Quotation"
                                                            >
                                                                <Pencil className="size-4" />
                                                            </MenuAction>

                                                            <a
                                                                href={`/marketing/quotation/${encodeURIComponent(item.No_penawaran)}/print`}
                                                                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-teal-600 hover:bg-teal-500/15 transition-all cursor-pointer"
                                                                title="Cetak Surat Penawaran"
                                                                target="_blank"
                                                                rel="noreferrer"
                                                            >
                                                                <Printer className="size-4" />
                                                            </a>

                                                            {Number(item.can_delete ?? 0) === 1 && (
                                                                <MenuAction
                                                                    action="delete"
                                                                    as="button"
                                                                    type="button"
                                                                    className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-500/15 transition-all cursor-pointer"
                                                                    title="Hapus Quotation"
                                                                    disabled={isDeleting}
                                                                    onClick={() => handleDelete(item.No_penawaran)}
                                                                >
                                                                    <Trash2 className="size-4" />
                                                                </MenuAction>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Footer */}
                            {pageSize !== Infinity && totalItems > 0 && (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-sidebar-border/60 text-sm text-muted-foreground bg-muted/20">
                                    <div className="flex items-center gap-1.5 font-medium">
                                        <span>Menampilkan</span>
                                        <span className="font-semibold text-foreground tracking-wide tabular-nums">
                                            {Math.min((currentPage - 1) * pageSize + 1, totalItems)} - {Math.min(currentPage * pageSize, totalItems)}
                                        </span>
                                        <span>dari</span>
                                        <span className="font-semibold text-foreground tracking-wide tabular-nums">{formatNumber(totalItems)}</span>
                                        <span>data</span>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 rounded-xl border-sidebar-border/80 text-sm font-semibold gap-1"
                                            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            <ChevronLeft className="size-4" />
                                            <span>Sebelumnya</span>
                                        </Button>

                                        <div className="px-3 py-1 rounded-lg bg-background border border-sidebar-border/70 text-sm font-semibold text-foreground tracking-wide tabular-nums">
                                            {currentPage} / {totalPages}
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 rounded-xl border-sidebar-border/80 text-sm font-semibold gap-1"
                                            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                                            disabled={currentPage === totalPages}
                                        >
                                            <span>Berikutnya</span>
                                            <ChevronRight className="size-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                            </div>
                        </div>
                    ) : (
                    /* ─── TAB 2: DATA MATERIAL (SERVER SIDE) ───────────────────── */
                    <div className="flex flex-col gap-4">
                        {/* Filter & Search Bar */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 sm:p-4 rounded-xl border border-sidebar-border/70 bg-card shadow-xs">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground font-semibold">Tampilkan:</span>
                                <select
                                    className="h-9 rounded-xl border border-sidebar-border/80 bg-background px-2.5 text-sm font-semibold text-foreground focus:outline-hidden cursor-pointer"
                                    value={materialPageSize === Infinity ? 'all' : materialPageSize}
                                    onChange={handleMaterialPageSizeChange}
                                >
                                    <option value={5}>5 Baris</option>
                                    <option value={10}>10 Baris</option>
                                    <option value={25}>25 Baris</option>
                                    <option value={50}>50 Baris</option>
                                    <option value="all">Semua</option>
                                </select>
                            </div>

                            <div className="relative w-full md:w-80">
                                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground/60" />
                                <input
                                    type="search"
                                    className="h-9 w-full rounded-xl border border-sidebar-border/80 bg-background pl-9 pr-8 text-sm font-medium placeholder:text-muted-foreground/60 focus:border-teal-500 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 transition-colors"
                                    placeholder="Cari No Penawaran atau Nama Material..."
                                    value={materialSearch}
                                    onChange={(e) => {
                                        setMaterialSearch(e.target.value);
                                        setMaterialCurrentPage(1);
                                    }}
                                />
                                {materialSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setMaterialSearch('')}
                                        className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                                    >
                                        <X className="size-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Table Card */}
                        <div className="overflow-hidden rounded-xl border border-sidebar-border/70 bg-card shadow-xs">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead>
                                        <tr className="border-b border-sidebar-border/60 bg-muted/40 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                            <th className="py-3.5 px-4 w-44 whitespace-nowrap">No Penawaran</th>
                                            <th className="py-3.5 px-4 min-w-[200px]">Nama Material</th>
                                            <th className="py-3.5 px-4 w-32 whitespace-nowrap">Qty / Satuan</th>
                                            <th className="py-3.5 px-4 w-36 text-right whitespace-nowrap">Harga Jual</th>
                                            <th className="py-3.5 px-4 w-36 text-right whitespace-nowrap">Harga Modal</th>
                                            <th className="py-3.5 px-4 w-20 text-center whitespace-nowrap">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-sidebar-border/40">
                                        <PlainTableStateRows
                                            columns={6}
                                            loading={materialLoading}
                                            isEmpty={!materialLoading && remoteMaterialDetails.length === 0}
                                            emptyTitle="Tidak ada data material"
                                            emptyDescription="Belum ada data detail material quotation yang sesuai dengan pencarian Anda."
                                        />
                                        {!materialLoading &&
                                            remoteMaterialDetails.map((item, idx) => (
                                                <tr
                                                    key={item.id_detail || idx}
                                                    className="hover:bg-muted/40 transition-colors group"
                                                >
                                                    <td className="py-3.5 px-4 whitespace-nowrap">
                                                        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-0.5 text-sm font-semibold text-foreground/90 border border-sidebar-border/60 tracking-wide tabular-nums">
                                                            {renderValue(item.No_Penawaran)}
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-4 min-w-[200px] text-sm font-semibold text-foreground">
                                                        <div className="flex items-center gap-2">
                                                            <Package className="size-3.5 text-muted-foreground/60 shrink-0" />
                                                            <span className="truncate uppercase" title={item.Material}>
                                                                {renderValue(item.Material)}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-4 whitespace-nowrap text-sm font-semibold tracking-wide tabular-nums">
                                                        <span className="text-foreground">{formatNumber(item.Qty)}</span>{' '}
                                                        <span className="text-muted-foreground">{item.Satuan ? renderValue(item.Satuan) : ''}</span>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right text-sm font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap tracking-wide tabular-nums">
                                                        Rp {formatNumber(item.Harga)}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right text-sm font-semibold text-muted-foreground whitespace-nowrap tracking-wide tabular-nums">
                                                        Rp {formatNumber(item.Harga_modal)}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenModal(item)}
                                                            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/15 transition-colors cursor-pointer"
                                                            title="Lihat Detail Penawaran"
                                                        >
                                                            <Eye className="size-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Footer Tab 2 */}
                            {materialPageSize !== Infinity && materialTotal > 0 && (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-sidebar-border/60 text-sm text-muted-foreground bg-muted/20">
                                    <div className="flex items-center gap-1.5 font-medium">
                                        <span>Menampilkan</span>
                                        <span className="font-semibold text-foreground tracking-wide tabular-nums">
                                            {Math.min((materialCurrentPage - 1) * materialPageSize + 1, materialTotal)} - {Math.min(materialCurrentPage * materialPageSize, materialTotal)}
                                        </span>
                                        <span>dari</span>
                                        <span className="font-semibold text-foreground tracking-wide tabular-nums">{formatNumber(materialTotal)}</span>
                                        <span>material</span>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 rounded-xl border-sidebar-border/80 text-sm font-semibold gap-1"
                                            disabled={materialCurrentPage === 1}
                                            onClick={() => setMaterialCurrentPage((page) => Math.max(1, page - 1))}
                                        >
                                            <ChevronLeft className="size-4" />
                                            <span>Sebelumnya</span>
                                        </Button>

                                        <div className="px-3 py-1 rounded-lg bg-background border border-sidebar-border/70 text-sm font-semibold text-foreground tracking-wide tabular-nums">
                                            {materialCurrentPage} / {tab2TotalPages}
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 rounded-xl border-sidebar-border/80 text-sm font-semibold gap-1"
                                            disabled={materialCurrentPage === tab2TotalPages}
                                            onClick={() => setMaterialCurrentPage((page) => Math.min(tab2TotalPages, page + 1))}
                                        >
                                            <span>Berikutnya</span>
                                            <ChevronRight className="size-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ─── 4. Redesigned Premium Detail Modal (Dialog) ─────────── */}
                <Dialog
                    open={isModalOpen}
                    onOpenChange={(open) => {
                        setIsModalOpen(open);
                        if (!open) {
                            setSelectedPenawaran(null);
                        }
                    }}
                >
                    <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-[95vw] lg:max-w-[94vw] xl:max-w-[92vw] 2xl:max-w-[1560px] max-h-[92vh] overflow-y-auto overflow-x-hidden rounded-2xl border border-sidebar-border/70 bg-card p-6 sm:p-8 shadow-lg space-y-6 focus:outline-none scrollbar-thin">
                        <DialogHeader className="border-b border-sidebar-border/50 pb-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                                            Detail Quotation
                                        </DialogTitle>
                                        {selectedPenawaran?.No_penawaran && (
                                            <span className="rounded-lg bg-emerald-500/15 px-2.5 py-0.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 tracking-wide tabular-nums">
                                                {selectedPenawaran.No_penawaran}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                        Informasi lengkap penawaran harga & rincian daftar material.
                                    </p>
                                </div>

                                {selectedPenawaran?.No_penawaran && (
                                    <a
                                        href={`/marketing/quotation/${encodeURIComponent(selectedPenawaran.No_penawaran)}/print`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-sidebar-border/80 bg-background hover:bg-sidebar-accent px-3 py-1.5 text-sm font-semibold text-foreground transition-all cursor-pointer shadow-xs"
                                    >
                                        <Printer className="size-4 text-emerald-600" />
                                        <span>Cetak Surat</span>
                                    </a>
                                )}
                            </div>
                        </DialogHeader>

                        {!selectedPenawaran ? (
                            <div className="py-8 text-center text-sm font-medium text-muted-foreground">
                                Memuat data penawaran...
                            </div>
                        ) : (
                            <div className="space-y-5 text-sm">
                                {/* Segmented Cards: Customer & Syarat */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Card Customer */}
                                    <div className="rounded-xl border border-sidebar-border/60 bg-muted/30 p-4 space-y-3">
                                        <div className="flex items-center gap-2 font-bold text-foreground text-sm border-b border-sidebar-border/40 pb-2">
                                            <Building2 className="size-4 text-emerald-600" />
                                            <span>Informasi Customer</span>
                                        </div>

                                        <div className="space-y-2.5 text-sm">
                                            <div className="flex justify-between items-baseline gap-2">
                                                <span className="text-muted-foreground font-medium shrink-0">Customer:</span>
                                                <span className="font-semibold text-foreground text-right break-words">{renderValue(selectedPenawaran.Customer)}</span>
                                            </div>
                                            <div className="flex justify-between items-baseline gap-2">
                                                <span className="text-muted-foreground font-medium shrink-0">Alamat:</span>
                                                <span className="font-semibold text-foreground/80 text-right break-words">{renderValue(selectedPenawaran.Alamat)}</span>
                                            </div>
                                            <div className="flex justify-between items-baseline gap-2">
                                                <span className="text-muted-foreground font-medium shrink-0">Telepon / Fax:</span>
                                                <span className="font-semibold text-foreground text-right break-words tracking-wide tabular-nums">
                                                    {renderValue(selectedPenawaran.Telp)}
                                                    {selectedPenawaran.Fax ? ` / ${selectedPenawaran.Fax}` : ''}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-baseline gap-2">
                                                <span className="text-muted-foreground font-medium shrink-0">Email:</span>
                                                <span className="font-semibold text-foreground text-right break-words">{renderValue(selectedPenawaran.Email)}</span>
                                            </div>
                                            <div className="flex justify-between items-baseline gap-2">
                                                <span className="text-muted-foreground font-medium shrink-0">Attend:</span>
                                                <span className="font-semibold text-indigo-600 dark:text-indigo-400 text-right break-words">{renderValue(selectedPenawaran.Attend)}</span>
                                            </div>
                                            <div className="flex justify-between items-baseline gap-2 pt-1 border-t border-sidebar-border/30">
                                                <span className="text-muted-foreground font-medium shrink-0">Tgl Penawaran:</span>
                                                <span className="font-semibold text-foreground tracking-wide tabular-nums">{renderValue(selectedPenawaran.Tgl_Penawaran)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Syarat & Ketentuan */}
                                    <div className="rounded-xl border border-sidebar-border/60 bg-muted/30 p-4 space-y-3">
                                        <div className="flex items-center gap-2 font-bold text-foreground text-sm border-b border-sidebar-border/40 pb-2">
                                            <FileText className="size-4 text-teal-600" />
                                            <span>Syarat & Catatan Penawaran</span>
                                        </div>

                                        <div className="space-y-2.5 text-sm">
                                            <div className="flex justify-between items-baseline gap-2">
                                                <span className="text-muted-foreground font-medium shrink-0">Payment Terms:</span>
                                                <span className="font-semibold text-foreground text-right break-words">
                                                    {renderValue(selectedPenawaran.Payment ?? selectedPenawaran.payment)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-baseline gap-2">
                                                <span className="text-muted-foreground font-medium shrink-0">Validity:</span>
                                                <span className="font-semibold text-foreground text-right break-words">{renderValue(selectedPenawaran.Validity)}</span>
                                            </div>
                                            <div className="flex justify-between items-baseline gap-2">
                                                <span className="text-muted-foreground font-medium shrink-0">Delivery:</span>
                                                <span className="font-semibold text-foreground text-right break-words">{renderValue(selectedPenawaran.Delivery)}</span>
                                            </div>
                                            <div className="flex justify-between items-baseline gap-2">
                                                <span className="text-muted-foreground font-medium shrink-0">Franco:</span>
                                                <span className="font-semibold text-foreground text-right break-words">{renderValue(selectedPenawaran.Franco)}</span>
                                            </div>
                                            {(() => {
                                                const activeNotes = [
                                                    selectedPenawaran.Note1,
                                                    selectedPenawaran.Note2,
                                                    selectedPenawaran.Note3,
                                                ].filter(isValidNote);

                                                if (activeNotes.length === 0) return null;

                                                return (
                                                    <div className="pt-1 border-t border-sidebar-border/30 space-y-1.5">
                                                        <span className="text-muted-foreground font-medium block">Notes:</span>
                                                        <div className="rounded-lg bg-background/80 p-2.5 border border-sidebar-border/40 text-sm space-y-1 text-foreground/90 font-medium break-words">
                                                            {activeNotes.map((noteText, idx) => (
                                                                <div key={idx}>
                                                                    {activeNotes.length > 1 ? `${idx + 1}. ` : ''}{String(noteText).trim()}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* Material Details Section */}
                                <div className="space-y-3 pt-2">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                        <div className="flex items-center gap-2 font-bold text-foreground text-sm">
                                            <Boxes className="size-4 text-emerald-600" />
                                            <span>Rincian Material ({materialModalTotalItems} Item)</span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <input
                                                type="search"
                                                className="h-9 rounded-xl border border-sidebar-border/80 bg-background px-3 text-sm placeholder:text-muted-foreground/60 focus:border-emerald-500 focus:outline-hidden"
                                                placeholder="Cari dalam detail..."
                                                value={materialSearchTerm}
                                                onChange={(event) => {
                                                    setMaterialSearchTerm(event.target.value);
                                                    setModalMaterialCurrentPage(1);
                                                }}
                                            />
                                            <select
                                                className="h-9 rounded-xl border border-sidebar-border/80 bg-background px-2.5 text-sm font-semibold cursor-pointer"
                                                value={modalMaterialPageSize === Infinity ? 'all' : modalMaterialPageSize}
                                                onChange={(event) => {
                                                    const value = event.target.value;
                                                    setModalMaterialPageSize(value === 'all' ? Infinity : Number(value));
                                                    setModalMaterialCurrentPage(1);
                                                }}
                                            >
                                                <option value={5}>5</option>
                                                <option value={10}>10</option>
                                                <option value={25}>25</option>
                                                <option value="all">Semua</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Material Sub-Table */}
                                    <div className="overflow-hidden rounded-xl border border-sidebar-border/70 bg-card">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-sm border-collapse">
                                                <thead>
                                                    <tr className="border-b border-sidebar-border/60 bg-muted/40 text-sm font-semibold uppercase text-muted-foreground tracking-wider">
                                                        <th className="py-3 px-3.5 w-14 text-center whitespace-nowrap">No</th>
                                                        <th className="py-3 px-3.5 min-w-[180px]">Material</th>
                                                        <th className="py-3 px-3.5 w-28 whitespace-nowrap">Qty</th>
                                                        <th className="py-3 px-3.5 w-36 text-right whitespace-nowrap">Harga</th>
                                                        <th className="py-3 px-3.5 w-36 text-right whitespace-nowrap">Modal</th>
                                                        <th className="py-3 px-3.5 w-24 text-center whitespace-nowrap">Margin</th>
                                                        <th className="py-3 px-3.5 min-w-[160px]">Remark</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-sidebar-border/40">
                                                    {detailLoading ? (
                                                        <tr>
                                                            <td colSpan={7} className="py-8 text-center text-sm font-medium text-muted-foreground">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <RefreshCw className="size-4 animate-spin text-emerald-500" />
                                                                    <span>Memuat detail material...</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ) : filteredMaterialDetails.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={7} className="py-8 text-center text-sm font-medium text-muted-foreground">
                                                                Tidak ada rincian material ditemukan.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        displayedMaterialDetails.map((detail, index) => (
                                                            <tr key={index} className="hover:bg-muted/30 transition-colors">
                                                                <td className="py-3 px-3.5 text-center text-sm font-semibold text-muted-foreground whitespace-nowrap tracking-wide tabular-nums">
                                                                    {modalMaterialPageSize === Infinity
                                                                        ? index + 1
                                                                        : (modalMaterialCurrentPage - 1) * modalMaterialPageSize + index + 1}
                                                                </td>
                                                                <td className="py-3 px-3.5 text-sm font-semibold text-foreground uppercase break-words">
                                                                    {renderValue(detail.Material)}
                                                                </td>
                                                                <td className="py-3 px-3.5 text-sm font-semibold text-foreground whitespace-nowrap tracking-wide tabular-nums">
                                                                    {formatNumber(detail.Qty)} {detail.Satuan || ''}
                                                                </td>
                                                                <td className="py-3 px-3.5 text-right text-sm font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap tracking-wide tabular-nums">
                                                                    Rp {formatNumber(detail.Harga)}
                                                                </td>
                                                                <td className="py-3 px-3.5 text-right text-sm font-semibold text-muted-foreground whitespace-nowrap tracking-wide tabular-nums">
                                                                    Rp {formatNumber(detail.Harga_Modal || detail.Harga_modal)}
                                                                </td>
                                                                <td className="py-3 px-3.5 text-center whitespace-nowrap">
                                                                    <span className="rounded-md bg-muted px-2 py-0.5 text-sm font-semibold tracking-wide tabular-nums">
                                                                        {formatPercent(detail.Margin)}
                                                                    </span>
                                                                </td>
                                                                <td className="py-3 px-3.5 align-top text-sm font-medium text-muted-foreground break-words">
                                                                    <FormattedRemark value={detail.Remark} />
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Modal Material Pagination */}
                                        {modalMaterialPageSize !== Infinity && materialModalTotalItems > 0 && (
                                            <div className="flex items-center justify-between p-3.5 border-t border-sidebar-border/40 text-sm text-muted-foreground bg-muted/20 font-medium">
                                                <span className="tracking-wide tabular-nums">
                                                    Halaman {modalMaterialCurrentPage} dari {materialModalTotalPages}
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 text-sm font-semibold px-3 rounded-lg"
                                                        onClick={() => setModalMaterialCurrentPage((page) => Math.max(1, page - 1))}
                                                        disabled={modalMaterialCurrentPage === 1}
                                                    >
                                                        Sebelumnya
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 text-sm font-semibold px-3 rounded-lg"
                                                        onClick={() => setModalMaterialCurrentPage((page) => Math.min(materialModalTotalPages, page + 1))}
                                                        disabled={modalMaterialCurrentPage === materialModalTotalPages}
                                                    >
                                                        Berikutnya
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                {/* ══ TOAST NOTIFIKASI KANAN ATAS DENGAN DURASI (TAILWIND CSS) ════════ */}
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
                                        <Check className="size-5 stroke-[2.5]" />
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
                                        animation: `toastProgress ${toast.duration || 4500}ms linear forwards`,
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
                                    {confirmModal.cancelText || 'Batal'}
                                </Button>
                                <Button
                                    type="button"
                                    variant={confirmModal.variant === 'danger' ? 'destructive' : 'default'}
                                    size="sm"
                                    className={`h-8 rounded-lg text-xs font-semibold px-3.5 gap-1.5 shadow-xs !text-white ${
                                        confirmModal.variant === 'danger'
                                            ? 'bg-destructive hover:bg-destructive/90 !text-white'
                                            : 'bg-amber-600 hover:bg-amber-700 !text-white'
                                    }`}
                                    onClick={() => {
                                        if (confirmModal.onConfirm) {
                                            confirmModal.onConfirm();
                                        }
                                    }}
                                >
                                    {confirmModal.variant === 'danger' && <Trash2 className="size-3.5" />}
                                    <span>{confirmModal.confirmText || 'Ya, Hapus'}</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

QuotationIndex.layout = (page) => <AppLayout children={page} breadcrumbs={breadcrumbs} />;
