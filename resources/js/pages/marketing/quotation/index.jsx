import { PlainTableStateRows } from '@/components/data-states/TableStateRows';
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
import { Head, Link, router } from '@inertiajs/react';
import { Eye, Pencil, Printer, Trash2, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/quotation' },
    { title: 'Quotation', href: '/marketing/quotation' },
];

const formatRupiah = (value) => {
    const number = Number(value);
    if (Number.isNaN(number)) {
        return '-';
    }

    return `Rp. ${new Intl.NumberFormat('id-ID').format(number)}`;
};

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

export default function QuotationIndex({
    penawaran = [],
    penawaranDetail = [],
    detailNo = null,
    period = 'today',
}) {
    // State Tab 1 (Customer)
    const [searchTerm, setSearchTerm] = useState('');
    const [pageSize, setPageSize] = useState(5);
    const [currentPage, setCurrentPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState(period);
    const [remotePenawaran, setRemotePenawaran] = useState(penawaran);
    
    const [loading, setLoading] = useState(false);
    
    // State Modal & Detail
    const [selectedPenawaran, setSelectedPenawaran] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [detailRows, setDetailRows] = useState([]);
    const [detailRowsNo, setDetailRowsNo] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [materialSearchTerm, setMaterialSearchTerm] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    
    // State Navigasi Tab Utama
    const [activeTab, setActiveTab] = useState('customer');

    // State Tab 2 (Material) - Server Side Pagination
    const [materialSearch, setMaterialSearch] = useState('');
    const [materialPageSize, setMaterialPageSize] = useState(5);
    const [materialCurrentPage, setMaterialCurrentPage] = useState(1);
    const [materialLoading, setMaterialLoading] = useState(false);
    const [remoteMaterialDetails, setRemoteMaterialDetails] = useState([]);
    const [materialTotal, setMaterialTotal] = useState(0);

    // ========================================================
    // FETCH DATA TAB 1 (CUSTOMER)
    // ========================================================
    const fetchQuotationData = useCallback(async (newPeriod) => {
        setLoading(true);
        try {
            const resPenawaran = await fetch(`/marketing/quotation/data?period=${newPeriod}`, { 
                headers: { Accept: 'application/json' } 
            });
            const dataPenawaran = await resPenawaran.json();
            setRemotePenawaran(dataPenawaran.penawaran || []);
            
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // ========================================================
    // FETCH DATA TAB 2 (MATERIAL) - SERVER SIDE PAGINATION
    // ========================================================
    const fetchMaterialData = useCallback(async (page, perPage, search) => {
        setMaterialLoading(true);
        try {
            const params = new URLSearchParams({
                page: page,
                per_page: perPage,
                search: search
            });
            const resMaterial = await fetch(`/marketing/quotation/materials-data?${params.toString()}`, {
                headers: { Accept: 'application/json' }
            });
            const dataMaterial = await resMaterial.json();
            setRemoteMaterialDetails(dataMaterial.materials || []);
            setMaterialTotal(dataMaterial.total || 0);
        } catch (error) {
            console.error('Error fetching material data:', error);
            setRemoteMaterialDetails([]);
            setMaterialTotal(0);
        } finally {
            setMaterialLoading(false);
        }
    }, []);

    useEffect(() => {
        setRemotePenawaran(penawaran);
    }, [penawaran]);

    useEffect(() => {
        fetchQuotationData(statusFilter);
    }, [statusFilter, fetchQuotationData]);

    const handlePeriodChange = (newPeriod) => {
        setStatusFilter(newPeriod);
        setCurrentPage(1);
    };

    // ========================================================
    // HANDLE TAB CHANGE - FETCH MATERIAL DATA SAAT TAB DIKLIK
    // ========================================================
    const handleTabChange = (tab) => {
        setActiveTab(tab);
        if (tab === 'material') {
            const effectivePerPage = materialPageSize === Infinity ? 999999 : materialPageSize;
            fetchMaterialData(materialCurrentPage, effectivePerPage, materialSearch);
        }
    };

    // ========================================================
    // FILTER & PAGINATION TAB 1 (CUSTOMER)
    // ========================================================
    const filteredPenawaran = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        const dataToFilter = remotePenawaran || [];
        if (!term) {
            return dataToFilter;
        }

        return dataToFilter.filter((item) => {
            const values = [
                item.No_penawaran,
                item.Tgl_penawaran,
                item.Customer,
                item.Attend,
            ];

            return values.some((value) =>
                String(value ?? '')
                    .toLowerCase()
                    .includes(term),
            );
        });
    }, [remotePenawaran, searchTerm]);

    const totalItems = useMemo(() => filteredPenawaran.length, [filteredPenawaran]);
    
    const totalPages = useMemo(() => {
        if (pageSize === Infinity) return 1;
        return Math.max(1, Math.ceil(totalItems / pageSize));
    }, [pageSize, totalItems]);

    const displayedPenawaran = useMemo(() => {
        if (pageSize === Infinity) return filteredPenawaran;
        const startIndex = (currentPage - 1) * pageSize;
        return filteredPenawaran.slice(startIndex, startIndex + pageSize);
    }, [currentPage, filteredPenawaran, pageSize]);

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

    // ========================================================
    // PAGINATION TAB 2 (MATERIAL) - SERVER SIDE
    // ========================================================
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
        const effectivePerPage = materialPageSize === Infinity ? 999999 : materialPageSize;
        fetchMaterialData(materialCurrentPage, effectivePerPage, materialSearch);
    }, [materialCurrentPage, materialPageSize, materialSearch, fetchMaterialData]);

    useEffect(() => {
        if (materialCurrentPage > tab2TotalPages) {
            setMaterialCurrentPage(tab2TotalPages);
        }
    }, [materialCurrentPage, tab2TotalPages]);

    // ========================================================
    // MODAL DETAIL - DIPERBAIKI UNTUK MENAMPILKAN HEADER DARI TAB 2
    // ========================================================
    const fetchHeaderData = useCallback(async (noPenawaran) => {
        try {
            const response = await fetch(`/marketing/quotation/${encodeURIComponent(noPenawaran)}/header`, {
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching header:', error);
            return null;
        }
    }, []);

    const fetchDetailData = useCallback(async (noPenawaran) => {
        try {
            const response = await fetch(`/marketing/quotation/${encodeURIComponent(noPenawaran)}/details`, {
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            if (!response.ok) return [];
            const data = await response.json();
            return Array.isArray(data?.details) ? data.details : [];
        } catch (error) {
            console.error('Error fetching details:', error);
            return [];
        }
    }, []);

    
    const handleOpenModal = async (item) => {
        const noPenawaran = item.No_penawaran || item.No_Penawaran;
        if (!noPenawaran) return;
    
        setDetailLoading(true);
        setIsModalOpen(true);
        setDetailRows([]);
    
        // 1. Ambil data Header dengan cara yang konsisten
        let header;
        if (item.Customer !== undefined) {
            // Data lengkap dari Tab 1
            header = item;
        } else {
            // Data dari Tab 2 (perlu fetch header)
            header = await fetchHeaderData(noPenawaran);
        }
    
        // 2. Normalisasi Data (PENTING!)
        // Pastikan properti "No_penawaran" dan "Tgl_Posting" selalu ada
        const normalizedHeader = {
            ...header,
            No_penawaran: header?.No_penawaran || header?.No_Penawaran || noPenawaran,
            Tgl_Posting: header?.Tgl_Posting || header?.tgl_posting || '-',
        };
    
        setSelectedPenawaran(normalizedHeader);
    
        // 3. Ambil Detail
        const details = await fetchDetailData(noPenawaran);
        setDetailRows(Array.isArray(details) ? details : (details.details || []));
        setDetailLoading(false);
    };
    // Untuk kasus item dari tab 1 yang mungkin langsung punya detail
    const selectedDetails = useMemo(() => {
        if (!selectedPenawaran) return [];
        const selectedNo = String(selectedPenawaran.No_penawaran ?? '').trim();
        if (detailRowsNo === selectedNo && detailRows.length > 0) return detailRows;
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
            return values.some((value) =>
                String(value ?? '').toLowerCase().includes(term),
            );
        });
    }, [materialSearchTerm, selectedDetails]);

    const materialModalTotalItems = filteredMaterialDetails.length;
    const materialModalTotalPages = useMemo(() => {
        if (materialPageSize === Infinity) return 1;
        return Math.max(1, Math.ceil(materialModalTotalItems / materialPageSize));
    }, [materialPageSize, materialModalTotalItems]);

    const displayedMaterialDetails = useMemo(() => {
        if (materialPageSize === Infinity) return filteredMaterialDetails;
        const startIndex = (materialCurrentPage - 1) * materialPageSize;
        return filteredMaterialDetails.slice(startIndex, startIndex + materialPageSize);
    }, [filteredMaterialDetails, materialCurrentPage, materialPageSize]);

    useEffect(() => {
        if (isModalOpen) {
            setMaterialSearchTerm('');
            setMaterialPageSize(5);
            setMaterialCurrentPage(1);
        } else {
            setDetailRows([]);
            setDetailRowsNo(null);
            setDetailLoading(false);
        }
    }, [isModalOpen, selectedPenawaran]);

    const handleDelete = (noPenawaran) => {
        if (!noPenawaran || isDeleting) return;

        Swal.fire({
            title: 'Hapus data?',
            text: `No Penawaran: ${noPenawaran}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, hapus',
            cancelButtonText: 'Batal',
            reverseButtons: true,
        }).then((result) => {
            if (!result.isConfirmed) return;

            setIsDeleting(true);
            fetch(`/marketing/quotation/${encodeURIComponent(noPenawaran)}`, {
                method: 'DELETE',
                headers: {
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
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
                    Swal.fire({
                        icon: 'success',
                        title: 'Berhasil',
                        text: data?.message || 'Data berhasil dihapus.',
                        timer: 1800,
                        showConfirmButton: false,
                    });
                    
                    if (activeTab === 'customer') {
                        fetchQuotationData(statusFilter);
                    } else {
                        const effectivePerPage = materialPageSize === Infinity ? 999999 : materialPageSize;
                        fetchMaterialData(materialCurrentPage, effectivePerPage, materialSearch);
                    }
                })
                .catch((error) => {
                    Swal.fire({
                        icon: 'error',
                        title: 'Gagal',
                        text: error.message,
                    });
                })
                .finally(() => setIsDeleting(false));
        });
    };

    return (
        <>
            <Head title="Quotation" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Quotation</h1>
                        <p className="text-sm text-muted-foreground">Daftar penawaran</p>
                    </div>
                    <Button
                        type="button"
                        onClick={() => router.visit('/marketing/quotation/create')}
                    >
                        Tambah Quotation
                    </Button>
                </div>

                {/* ==================== NAVIGASI TABS ==================== */}
                <div className="mt-4 flex border-b border-sidebar-border">
                    <button
                        type="button"
                        className={`px-4 py-2 text-sm font-medium transition-all border-b-2 ${
                            activeTab === 'customer'
                                ? 'border-primary text-primary font-bold'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => handleTabChange('customer')}
                    >
                        Data Quotation Customer
                    </button>
                    <button
                        type="button"
                        className={`px-4 py-2 text-sm font-medium transition-all border-b-2 ${
                            activeTab === 'material'
                                ? 'border-primary text-primary font-bold'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => handleTabChange('material')}
                    >
                        Data Quotation Material
                    </button>
                </div>

                {/* ==================== TAB 1: DATA CUSTOMER ==================== */}
                {activeTab === 'customer' && (
                    <div className="mt-2 flex flex-col gap-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-3">
                                <Select value={statusFilter} onValueChange={handlePeriodChange}>
                                    <SelectTrigger className="w-[160px] bg-background">
                                        <SelectValue placeholder="Pilih Periode" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="today">Hari Ini</SelectItem>
                                        <SelectItem value="week">Minggu Ini</SelectItem>
                                        <SelectItem value="month">Bulan Ini</SelectItem>
                                        <SelectItem value="year">Tahun Ini</SelectItem>
                                        <SelectItem value="all">Semua Data</SelectItem>
                                    </SelectContent>
                                </Select>

                                <label className="ml-2 text-sm text-muted-foreground">
                                    Tampilkan
                                    <select
                                        className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                        value={pageSize === Infinity ? 'all' : pageSize}
                                        onChange={handlePageSizeChange}
                                    >
                                        <option value={5}>5</option>
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value="all">Semua</option>
                                    </select>
                                </label>
                            </div>
                            <label className="text-sm text-muted-foreground">
                                Cari
                                <input
                                    type="search"
                                    className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm"
                                    placeholder="Cari data..."
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                />
                            </label>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 text-left">No Penawaran</th>
                                        <th className="px-4 py-3 text-left">Tanggal</th>
                                        <th className="px-4 py-3 text-left">Customer</th>
                                        <th className="px-4 py-3 text-left">Attend</th>
                                        <th className="px-4 py-3 text-left">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <PlainTableStateRows
                                        columns={5}
                                        loading={loading}
                                        isEmpty={!loading && displayedPenawaran.length === 0}
                                    />
                                    {!loading &&
                                        displayedPenawaran.map((item) => (
                                            <tr key={item.No_penawaran} className="border-t border-sidebar-border/70">
                                                <td className="px-4 py-3">{item.No_penawaran}</td>
                                                <td className="px-4 py-3">{item.Tgl_penawaran}</td>
                                                <td className="px-4 py-3">{item.Customer}</td>
                                                <td className="px-4 py-3">{item.Attend}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenModal(item)}
                                                            className="text-muted-foreground transition hover:text-foreground"
                                                            title="Lihat"
                                                        >
                                                            <Eye className="size-4" />
                                                        </button>
                                                        <Link
                                                            href={`/marketing/quotation/${encodeURIComponent(item.No_penawaran)}/edit`}
                                                            className="text-muted-foreground transition hover:text-foreground"
                                                            title="Edit"
                                                        >
                                                            <Pencil className="size-4" />
                                                        </Link>
                                                        <a
                                                            href={`/marketing/quotation/${encodeURIComponent(item.No_penawaran)}/print`}
                                                            className="text-muted-foreground transition hover:text-foreground"
                                                            title="Cetak"
                                                            target="_blank"
                                                            rel="noreferrer"
                                                        >
                                                            <Printer className="size-4" />
                                                        </a>
                                                        {Number(item.can_delete ?? 0) === 1 && (
                                                            <button
                                                                type="button"
                                                                className="text-muted-foreground transition hover:text-destructive"
                                                                title="Hapus"
                                                                disabled={isDeleting}
                                                                onClick={() => handleDelete(item.No_penawaran)}
                                                            >
                                                                <Trash2 className="size-4" />
                                                            </button>
                                                        )}
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
                                    Menampilkan {Math.min((currentPage - 1) * pageSize + 1, totalItems)} - {Math.min(currentPage * pageSize, totalItems)} dari {totalItems} data
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
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
                                        onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                                        disabled={currentPage === totalPages}
                                    >
                                        Berikutnya
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ==================== TAB 2: DATA MATERIAL (DIUBAH SESUAI PERMINTAAN) ==================== */}
                {activeTab === 'material' && (
                    <div className="mt-2 flex flex-col gap-4 animate-in fade-in duration-300">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <label className="text-sm text-muted-foreground">
                                Tampilkan
                                <select
                                    className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                    value={materialPageSize === Infinity ? 'all' : materialPageSize}
                                    onChange={handleMaterialPageSizeChange}
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value="all">Semua</option>
                                </select>
                            </label>
                            <label className="text-sm text-muted-foreground">
                                Cari
                                <input
                                    type="search"
                                    className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm w-64 md:w-80"
                                    placeholder="Cari No. Penawaran atau Material..."
                                    value={materialSearch}
                                    onChange={(e) => {
                                        setMaterialSearch(e.target.value);
                                        setMaterialCurrentPage(1);
                                    }}
                                />
                            </label>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 text-left">No Penawaran</th>
                                        <th className="px-4 py-3 text-left">Material</th>
                                        <th className="px-4 py-3 text-left">Qty / Satuan</th>
                                        <th className="px-4 py-3 text-right">Harga</th>
                                        <th className="px-4 py-3 text-right">Harga Modal</th>
                                        <th className="px-4 py-3 text-left">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <PlainTableStateRows
                                        columns={6}
                                        loading={materialLoading}
                                        isEmpty={!materialLoading && remoteMaterialDetails.length === 0}
                                        emptyMessage="Tidak ada data quotation material ditemukan."
                                    />
                                    {!materialLoading &&
                                        remoteMaterialDetails.map((item, idx) => (
                                            <tr key={item.id_detail || idx} className="border-t border-sidebar-border/70">
                                                <td className="px-4 py-3">{renderValue(item.No_Penawaran)}</td>
                                                <td className="px-4 py-3 max-w-[250px] truncate uppercase" title={item.Material}>
                                                    {renderValue(item.Material)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {item.Qty} {item.Satuan ? renderValue(item.Satuan) : ''}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono font-bold">
                                                    {formatRupiah(item.Harga)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono">
                                                    {formatRupiah(item.Harga_modal)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenModal(item)}
                                                        className="text-muted-foreground transition hover:text-foreground"
                                                        title="Lihat"
                                                    >
                                                        <Eye className="size-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>

                        {materialPageSize !== Infinity && materialTotal > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                <span>
                                    Menampilkan {Math.min((materialCurrentPage - 1) * materialPageSize + 1, materialTotal)} - {Math.min(materialCurrentPage * materialPageSize, materialTotal)} dari {materialTotal} data
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={materialCurrentPage === 1}
                                        onClick={() => setMaterialCurrentPage((page) => Math.max(1, page - 1))}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span className="text-sm text-muted-foreground">
                                        Halaman {materialCurrentPage} dari {tab2TotalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={materialCurrentPage === tab2TotalPages}
                                        onClick={() => setMaterialCurrentPage((page) => Math.min(tab2TotalPages, page + 1))}
                                    >
                                        Berikutnya
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ==================== DIALOG DETAIL MODAL ==================== */}
                <Dialog
                    open={isModalOpen}
                    onOpenChange={(open) => {
                        setIsModalOpen(open);
                        if (!open) {
                            setSelectedPenawaran(null);
                        }
                    }}
                >
                    <DialogContent className="!top-0 !left-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-y-auto !rounded-none">
                        <DialogHeader>
                            <DialogTitle>Detail Quotation</DialogTitle>
                        </DialogHeader>

                        {!selectedPenawaran && (
                            <p className="text-sm text-muted-foreground">Data tidak tersedia.</p>
                        )}

                        {selectedPenawaran && (
                            <div className="flex flex-col gap-6 text-sm">
                                <div className="grid gap-6 lg:grid-cols-2">
                                    <div className="space-y-3">
                                        <h3 className="text-base font-semibold">Data Customer</h3>
                                        <div className="grid gap-2">
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">Nomor Penawaran</span>
                                                <span>{renderValue(selectedPenawaran.No_penawaran)}</span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">Tanggal</span>
                                                <span>{renderValue(selectedPenawaran.Tgl_penawaran || selectedPenawaran.Tgl_Penawaran)}</span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">Posting Date</span>
                                                <span>{renderValue(selectedPenawaran.Tgl_Posting)}</span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">Customer</span>
                                                <span>{renderValue(selectedPenawaran.Customer)}</span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">Alamat</span>
                                                <span>{renderValue(selectedPenawaran.Alamat)}</span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">Telepon/Fax</span>
                                                <span>
                                                    {renderValue(selectedPenawaran.Telp)}
                                                    {selectedPenawaran.Fax ? ` / ${selectedPenawaran.Fax}` : ''}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">Email</span>
                                                <span>{renderValue(selectedPenawaran.Email)}</span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">Attend</span>
                                                <span>{renderValue(selectedPenawaran.Attend)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h3 className="text-base font-semibold">Detail</h3>
                                        <div className="grid gap-2">
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">Validity</span>
                                                <span>{renderValue(selectedPenawaran.Validity)}</span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">Delivery</span>
                                                <span>{renderValue(selectedPenawaran.Delivery)}</span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">Franco</span>
                                                <span>{renderValue(selectedPenawaran.Franco)}</span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">Note 1</span>
                                                <span>{renderValue(selectedPenawaran.Note1)}</span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">Note 2</span>
                                                <span>{renderValue(selectedPenawaran.Note2)}</span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">Note 3</span>
                                                <span>{renderValue(selectedPenawaran.Note3)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-base font-semibold">Data Material</h3>
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <label className="text-sm text-muted-foreground">
                                            Tampilkan
                                            <select
                                                className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
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
                                        <label className="text-sm text-muted-foreground">
                                            Cari Material
                                            <input
                                                type="search"
                                                className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm"
                                                placeholder="Cari material..."
                                                value={materialSearchTerm}
                                                onChange={(event) => {
                                                    setMaterialSearchTerm(event.target.value);
                                                    setMaterialCurrentPage(1);
                                                }}
                                            />
                                        </label>
                                    </div>
                                    <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/50 text-muted-foreground">
                                                <tr>
                                                    <th className="px-4 py-3 text-left">No</th>
                                                    <th className="px-4 py-3 text-left">Material</th>
                                                    <th className="px-4 py-3 text-left">Qty</th>
                                                    <th className="px-4 py-3 text-left">Harga</th>
                                                    <th className="px-4 py-3 text-left">Harga Modal</th>
                                                    <th className="px-4 py-3 text-left">Margin</th>
                                                    <th className="px-4 py-3 text-left">Remark</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {detailLoading ? (
                                                    <tr>
                                                        <td colSpan="6" className="text-center py-4">Loading...</td>
                                                    </tr>
                                                ) : detailRows.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="6" className="text-center py-4">Tidak ada data detail.</td>
                                                    </tr>
                                                ) : (
                                                    detailRows.map((detail, index) => (
                                                        <tr key={index} className="border-t border-sidebar-border/70">
                                                            <td className="px-4 py-3">{index + 1}</td>
                                                            <td className="px-4 py-3">{detail.Material}</td>
                                                            <td className="px-4 py-3">{detail.Qty} {detail.Satuan}</td>
                                                            <td className="px-4 py-3">{formatRupiah(detail.Harga)}</td>
                                                            <td className="px-4 py-3">{formatRupiah(detail.Harga_modal)}</td>
                                                            <td className="px-4 py-3">{detail.Margin}</td>
                                                            <td className="px-4 py-3">{detail.Remark}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    {materialPageSize !== Infinity && materialModalTotalItems > 0 && (
                                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                            <span>
                                                Menampilkan {Math.min((materialCurrentPage - 1) * materialPageSize + 1, materialModalTotalItems)} - {Math.min(materialCurrentPage * materialPageSize, materialModalTotalItems)} dari {materialModalTotalItems} data
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setMaterialCurrentPage((page) => Math.max(1, page - 1))}
                                                    disabled={materialCurrentPage === 1}
                                                >
                                                    Sebelumnya
                                                </Button>
                                                <span className="text-sm text-muted-foreground">
                                                    Halaman {materialCurrentPage} dari {materialModalTotalPages}
                                                </span>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setMaterialCurrentPage((page) => Math.min(materialModalTotalPages, page + 1))}
                                                    disabled={materialCurrentPage === materialModalTotalPages}
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
            </div>
        </>
    );
}

QuotationIndex.layout = (page) => (
    <AppLayout children={page} breadcrumbs={breadcrumbs} />
);
