import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router } from '@inertiajs/react';
import { Eye, Pencil, Printer, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { useEffect, useMemo, useState } from 'react';

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

const renderValue = (value) => (value === null || value === undefined || value === '' ? '-' : value);

export default function QuotationIndex({
    penawaran = [],
    penawaranDetail = [],
    detailNo = null,
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedPenawaran, setSelectedPenawaran] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [detailRows, setDetailRows] = useState([]);
    const [detailRowsNo, setDetailRowsNo] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [materialSearchTerm, setMaterialSearchTerm] = useState('');
    const [materialPageSize, setMaterialPageSize] = useState(10);
    const [materialCurrentPage, setMaterialCurrentPage] = useState(1);
    const [isDeleting, setIsDeleting] = useState(false);

    const filteredPenawaran = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) {
            return penawaran;
        }

        return penawaran.filter((item) => {
            const values = [
                item.No_penawaran,
                item.Tgl_penawaran,
                item.Customer,
                item.Attend,
                item.payment,
            ];

            return values.some((value) =>
                String(value ?? '').toLowerCase().includes(term)
            );
        });
    }, [penawaran, searchTerm]);

    const totalItems = filteredPenawaran.length;
    const totalPages = useMemo(() => {
        if (pageSize === Infinity) {
            return 1;
        }

        return Math.max(1, Math.ceil(totalItems / pageSize));
    }, [pageSize, totalItems]);

    const displayedPenawaran = useMemo(() => {
        if (pageSize === Infinity) {
            return filteredPenawaran;
        }

        const startIndex = (currentPage - 1) * pageSize;
        return filteredPenawaran.slice(startIndex, startIndex + pageSize);
    }, [currentPage, filteredPenawaran, pageSize]);

    const handlePageSizeChange = (event) => {
        const value = event.target.value;
        setPageSize(value === 'all' ? Infinity : Number(value));
    };

    const selectedDetails = useMemo(() => {
        if (!selectedPenawaran) {
            return [];
        }

        const selectedNo = String(selectedPenawaran.No_penawaran ?? '').trim();
        const currentDetailNo = detailNo ? String(detailNo).trim() : '';
        if (detailRowsNo === selectedNo && detailRows.length > 0) {
            return detailRows;
        }
        if (!selectedNo || currentDetailNo !== selectedNo) {
            return [];
        }

        return penawaranDetail;
    }, [detailNo, detailRows, detailRowsNo, penawaranDetail, selectedPenawaran]);

    const filteredMaterialDetails = useMemo(() => {
        const term = materialSearchTerm.trim().toLowerCase();
        if (!term) {
            return selectedDetails;
        }

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
                String(value ?? '').toLowerCase().includes(term)
            );
        });
    }, [materialSearchTerm, selectedDetails]);

    const materialTotalItems = filteredMaterialDetails.length;
    const materialTotalPages = useMemo(() => {
        if (materialPageSize === Infinity) {
            return 1;
        }

        return Math.max(1, Math.ceil(materialTotalItems / materialPageSize));
    }, [materialPageSize, materialTotalItems]);

    const displayedMaterialDetails = useMemo(() => {
        if (materialPageSize === Infinity) {
            return filteredMaterialDetails;
        }

        const startIndex = (materialCurrentPage - 1) * materialPageSize;
        return filteredMaterialDetails.slice(
            startIndex,
            startIndex + materialPageSize
        );
    }, [filteredMaterialDetails, materialCurrentPage, materialPageSize]);

    const handleOpenModal = (item) => {
        setSelectedPenawaran(item);
        setIsModalOpen(true);

        const selectedNo = String(item.No_penawaran ?? '').trim();
        const currentDetailNo = detailNo ? String(detailNo).trim() : '';
        if (selectedNo && (currentDetailNo !== selectedNo || penawaranDetail.length === 0)) {
            router.get(
                '/marketing/quotation',
                { detail_no: selectedNo },
                {
                    preserveState: true,
                    preserveScroll: true,
                    only: ['penawaranDetail', 'detailNo'],
                }
            );
        }

        if (selectedNo && detailRowsNo !== selectedNo) {
            setDetailLoading(true);
            setDetailRows([]);
            setDetailRowsNo(selectedNo);
            fetch(`/marketing/quotation/${encodeURIComponent(selectedNo)}/details`, {
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
            })
                .then((response) => (response.ok ? response.json() : null))
                .then((data) => {
                    const details = Array.isArray(data?.details) ? data.details : [];
                    setDetailRows(details);
                })
                .catch(() => {
                    setDetailRows([]);
                })
                .finally(() => {
                    setDetailLoading(false);
                });
        }
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [pageSize, searchTerm]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    useEffect(() => {
        if (isModalOpen) {
            setMaterialSearchTerm('');
            setMaterialPageSize(10);
            setMaterialCurrentPage(1);
        } else {
            setDetailRows([]);
            setDetailRowsNo(null);
            setDetailLoading(false);
        }
    }, [isModalOpen, selectedPenawaran]);

    useEffect(() => {
        if (materialCurrentPage > materialTotalPages) {
            setMaterialCurrentPage(materialTotalPages);
        }
    }, [materialCurrentPage, materialTotalPages]);

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
                    'X-CSRF-TOKEN': document
                        .querySelector('meta[name="csrf-token"]')
                        ?.getAttribute('content') ?? '',
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
                    router.reload({ only: ['penawaran'] });
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
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Quotation" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Quotation</h1>
                        <p className="text-sm text-muted-foreground">
                            Daftar penawaran
                        </p>
                    </div>
                    <Button
                        type="button"
                        onClick={() => router.visit('/marketing/quotation/create')}
                    >
                        Tambah Quotation
                    </Button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <label className="text-sm text-muted-foreground">
                            Tampilkan
                            <select
                                className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                value={pageSize === Infinity ? 'all' : pageSize}
                                onChange={handlePageSizeChange}
                            >
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
                                <th className="px-4 py-3 text-left">Payment</th>
                                <th className="px-4 py-3 text-left">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedPenawaran.length === 0 && (
                                <tr>
                                    <td
                                        className="px-4 py-6 text-center text-muted-foreground"
                                        colSpan={6}
                                    >
                                        Belum ada data penawaran.
                                    </td>
                                </tr>
                            )}
                            {displayedPenawaran.map((item) => (
                                <tr
                                    key={item.No_penawaran}
                                    className="border-t border-sidebar-border/70"
                                >
                                    <td className="px-4 py-3">
                                        {item.No_penawaran}
                                    </td>
                                    <td className="px-4 py-3">
                                        {item.Tgl_penawaran}
                                    </td>
                                    <td className="px-4 py-3">{item.Customer}</td>
                                    <td className="px-4 py-3">{item.Attend}</td>
                                    <td className="px-4 py-3">
                                        {item.Payment ?? item.payment}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenModal(item)}
                                                className="text-muted-foreground transition hover:text-foreground"
                                                aria-label="Lihat"
                                                title="Lihat"
                                            >
                                                <Eye className="size-4" />
                                            </button>
                                            <Link
                                                href={`/marketing/quotation/${encodeURIComponent(item.No_penawaran)}/edit`}
                                                className="text-muted-foreground transition hover:text-foreground"
                                                aria-label="Edit"
                                                title="Edit"
                                            >
                                                <Pencil className="size-4" />
                                            </Link>
                                            <a
                                                href={`/marketing/quotation/${encodeURIComponent(item.No_penawaran)}/print`}
                                                className="text-muted-foreground transition hover:text-foreground"
                                                aria-label="Cetak"
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
                                                    aria-label="Hapus"
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
                            Menampilkan{' '}
                            {Math.min((currentPage - 1) * pageSize + 1, totalItems)}-
                            {Math.min(currentPage * pageSize, totalItems)} dari{' '}
                            {totalItems} data
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    setCurrentPage((page) => Math.max(1, page - 1))
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
                                        Math.min(totalPages, page + 1)
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
                            setSelectedPenawaran(null);
                        }
                    }}
                >
                    <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Detail Quotation</DialogTitle>
                        </DialogHeader>

                        {!selectedPenawaran && (
                            <p className="text-sm text-muted-foreground">
                                Data tidak tersedia.
                            </p>
                        )}

                        {selectedPenawaran && (
                            <div className="flex flex-col gap-6 text-sm">
                                <div className="grid gap-6 lg:grid-cols-2">
                                    <div className="space-y-3">
                                        <h3 className="text-base font-semibold">
                                            Data Customer
                                        </h3>
                                        <div className="grid gap-2">
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Nomor Penawaran
                                                </span>
                                                <span>
                                                    {renderValue(
                                                        selectedPenawaran.No_penawaran
                                                    )}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Tanggal
                                                </span>
                                                <span>
                                                    {renderValue(
                                                        selectedPenawaran.Tgl_penawaran
                                                    )}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Posting Date
                                                </span>
                                                <span>
                                                    {renderValue(
                                                        selectedPenawaran.Tgl_Posting
                                                    )}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Customer
                                                </span>
                                                <span>
                                                    {renderValue(
                                                        selectedPenawaran.Customer
                                                    )}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Alamat
                                                </span>
                                                <span>
                                                    {renderValue(
                                                        selectedPenawaran.Alamat
                                                    )}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Telepon/Fax
                                                </span>
                                                <span>
                                                    {renderValue(
                                                        selectedPenawaran.Telp
                                                    )}
                                                    {selectedPenawaran.Fax
                                                        ? ` / ${selectedPenawaran.Fax}`
                                                        : ''}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Email
                                                </span>
                                                <span>
                                                    {renderValue(
                                                        selectedPenawaran.Email
                                                    )}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Attend
                                                </span>
                                                <span>
                                                    {renderValue(
                                                        selectedPenawaran.Attend
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h3 className="text-base font-semibold">
                                            Detail
                                        </h3>
                                        <div className="grid gap-2">
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Payment
                                                </span>
                                                <span>
                                                    {renderValue(
                                                        selectedPenawaran.Payment ??
                                                            selectedPenawaran.payment
                                                    )}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Validity
                                                </span>
                                                <span>
                                                    {renderValue(
                                                        selectedPenawaran.Validity
                                                    )}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Delivery
                                                </span>
                                                <span>
                                                    {renderValue(
                                                        selectedPenawaran.Delivery
                                                    )}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Franco
                                                </span>
                                                <span>
                                                    {renderValue(
                                                        selectedPenawaran.Franco
                                                    )}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Note 1
                                                </span>
                                                <span>
                                                    {renderValue(
                                                        selectedPenawaran.Note1
                                                    )}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Note 2
                                                </span>
                                                <span>
                                                    {renderValue(
                                                        selectedPenawaran.Note2
                                                    )}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[150px_1fr] gap-2">
                                                <span className="text-muted-foreground">
                                                    Note 3
                                                </span>
                                                <span>
                                                    {renderValue(
                                                        selectedPenawaran.Note3
                                                    )}
                                                </span>
                                            </div>
                                        </div>
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
                                                    materialPageSize === Infinity
                                                        ? 'all'
                                                        : materialPageSize
                                                }
                                                onChange={(event) => {
                                                    const value = event.target.value;
                                                    setMaterialPageSize(
                                                        value === 'all'
                                                            ? Infinity
                                                            : Number(value)
                                                    );
                                                    setMaterialCurrentPage(1);
                                                }}
                                            >
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
                                                    setMaterialSearchTerm(
                                                        event.target.value
                                                    );
                                                    setMaterialCurrentPage(1);
                                                }}
                                            />
                                        </label>
                                    </div>
                                    <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/50 text-muted-foreground">
                                                <tr>
                                                    <th className="px-4 py-3 text-left">
                                                        No
                                                    </th>
                                                    <th className="px-4 py-3 text-left">
                                                        Material
                                                    </th>
                                                    <th className="px-4 py-3 text-left">
                                                        Qty
                                                    </th>
                                                    <th className="px-4 py-3 text-left">
                                                        Harga
                                                    </th>
                                                    <th className="px-4 py-3 text-left">
                                                        Satuan
                                                    </th>
                                                    <th className="px-4 py-3 text-left">
                                                        Harga Modal
                                                    </th>
                                                    <th className="px-4 py-3 text-left">
                                                        Margin
                                                    </th>
                                                    <th className="px-4 py-3 text-left">
                                                        Remark
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                            {displayedMaterialDetails.length === 0 && (
                                                <tr>
                                                    <td
                                                        className="px-4 py-6 text-center text-muted-foreground"
                                                        colSpan={8}
                                                    >
                                                        {detailLoading
                                                            ? 'Memuat data material...'
                                                            : 'Belum ada data material.'}
                                                    </td>
                                                </tr>
                                            )}
                                                {displayedMaterialDetails.map(
                                                    (detail, index) => (
                                                    <tr
                                                        key={`${detail.No_penawaran}-${index}`}
                                                        className="border-t border-sidebar-border/70"
                                                    >
                                                        <td className="px-4 py-3">
                                                            {(materialPageSize === Infinity
                                                                ? index
                                                                : (materialCurrentPage - 1) *
                                                                      materialPageSize +
                                                                  index) + 1}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {renderValue(
                                                                detail.Material
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {renderValue(detail.Qty)}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {formatRupiah(detail.Harga)}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {renderValue(
                                                                detail.Satuan
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {formatRupiah(
                                                                detail.Harga_modal
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {renderValue(
                                                                detail.Margin
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {renderValue(
                                                                detail.Remark
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
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
                                                    (materialCurrentPage - 1) *
                                                        materialPageSize +
                                                        1,
                                                    materialTotalItems
                                                )}
                                                -
                                                {Math.min(
                                                    materialCurrentPage *
                                                        materialPageSize,
                                                    materialTotalItems
                                                )}{' '}
                                                dari {materialTotalItems} data
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
                                                                    page - 1
                                                                )
                                                        )
                                                    }
                                                    disabled={materialCurrentPage === 1}
                                                >
                                                    Sebelumnya
                                                </Button>
                                                <span className="text-sm text-muted-foreground">
                                                    Halaman {materialCurrentPage} dari{' '}
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
                                                                    page + 1
                                                                )
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
            </div>
        </AppLayout>
    );
}
