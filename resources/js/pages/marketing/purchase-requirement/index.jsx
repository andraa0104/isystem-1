
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router } from '@inertiajs/react';
import { Eye, Pencil, Printer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/purchase-requirement' },
    { title: 'Purchase Requirement', href: '/marketing/purchase-requirement' },
];

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const getValue = (source, keys) => {
    for (const key of keys) {
        const value = source?.[key];
        if (value !== null && value !== undefined && value !== '') {
            return value;
        }
    }
    return '-';
};

export default function PurchaseRequirementIndex({
    purchaseRequirements = [],
    outstandingCount = 0,
    realizedCount = 0,
    outstandingTotal = 0,
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('outstanding');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedPr, setSelectedPr] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isOutstandingModalOpen, setIsOutstandingModalOpen] = useState(false);
    const [outstandingSearchTerm, setOutstandingSearchTerm] = useState('');
    const [outstandingPageSize, setOutstandingPageSize] = useState(10);
    const [outstandingCurrentPage, setOutstandingCurrentPage] = useState(1);
    const [materialSearchTerm, setMaterialSearchTerm] = useState('');
    const [materialPageSize, setMaterialPageSize] = useState(10);
    const [materialCurrentPage, setMaterialCurrentPage] = useState(1);
    const [selectedDetails, setSelectedDetails] = useState([]);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');
    const [outstandingList, setOutstandingList] = useState([]);
    const [outstandingLoading, setOutstandingLoading] = useState(false);
    const [outstandingError, setOutstandingError] = useState('');

    const filteredPurchaseRequirements = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        const filtered = purchaseRequirements.filter((item) => {
            const outstanding = Number(item.outstanding_count ?? 0) > 0;
            const realized = Number(item.realized_count ?? 0) > 0;
            if (statusFilter === 'outstanding' && !outstanding) {
                return false;
            }
            if (statusFilter === 'realized' && !realized) {
                return false;
            }

            if (!term) {
                return true;
            }

            const values = [
                item.no_pr,
                item.date,
                item.for_customer,
                item.ref_po,
            ];

            return values.some((value) =>
                String(value ?? '').toLowerCase().includes(term)
            );
        });
        return filtered.sort((a, b) =>
            String(b.no_pr ?? '').localeCompare(String(a.no_pr ?? ''))
        );
    }, [purchaseRequirements, searchTerm, statusFilter]);

    const totalItems = filteredPurchaseRequirements.length;
    const totalPages = useMemo(() => {
        if (pageSize === Infinity) {
            return 1;
        }

        return Math.max(1, Math.ceil(totalItems / pageSize));
    }, [pageSize, totalItems]);

    const displayedPurchaseRequirements = useMemo(() => {
        if (pageSize === Infinity) {
            return filteredPurchaseRequirements;
        }

        const startIndex = (currentPage - 1) * pageSize;
        return filteredPurchaseRequirements.slice(
            startIndex,
            startIndex + pageSize
        );
    }, [currentPage, filteredPurchaseRequirements, pageSize]);

    const outstandingPurchaseRequirements = useMemo(() => {
        const term = outstandingSearchTerm.trim().toLowerCase();
        return outstandingList.filter((item) => {
            const outstanding = Number(item.outstanding_count ?? 0) > 0;
            if (!outstanding) {
                return false;
            }

            if (!term) {
                return true;
            }

            const values = [item.no_pr, item.date, item.for_customer, item.ref_po];
            return values.some((value) =>
                String(value ?? '').toLowerCase().includes(term)
            );
        }).sort((a, b) =>
            String(b.no_pr ?? '').localeCompare(String(a.no_pr ?? ''))
        );
    }, [outstandingList, outstandingSearchTerm]);

    const outstandingTotalItems = outstandingPurchaseRequirements.length;
    const outstandingTotalPages = useMemo(() => {
        if (outstandingPageSize === Infinity) {
            return 1;
        }

        return Math.max(1, Math.ceil(outstandingTotalItems / outstandingPageSize));
    }, [outstandingPageSize, outstandingTotalItems]);

    const displayedOutstandingPurchaseRequirements = useMemo(() => {
        if (outstandingPageSize === Infinity) {
            return outstandingPurchaseRequirements;
        }

        const startIndex = (outstandingCurrentPage - 1) * outstandingPageSize;
        return outstandingPurchaseRequirements.slice(
            startIndex,
            startIndex + outstandingPageSize
        );
    }, [
        outstandingCurrentPage,
        outstandingPageSize,
        outstandingPurchaseRequirements,
    ]);

    const handlePageSizeChange = (event) => {
        const value = event.target.value;
        setPageSize(value === 'all' ? Infinity : Number(value));
    };

    const filteredMaterialDetails = useMemo(() => {
        const term = materialSearchTerm.trim().toLowerCase();
        if (!term) {
            return selectedDetails;
        }

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
        setSelectedPr(item);
        setIsModalOpen(true);
        setSelectedDetails([]);
        setDetailError('');
        setDetailLoading(true);
        fetch(
            `/marketing/purchase-requirement/details?no_pr=${encodeURIComponent(
                item.no_pr
            )}`,
            { headers: { Accept: 'application/json' } }
        )
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Request failed');
                }
                return response.json();
            })
            .then((data) => {
                setSelectedDetails(
                    Array.isArray(data?.purchaseRequirementDetails)
                        ? data.purchaseRequirementDetails
                        : []
                );
            })
            .catch(() => {
                setDetailError('Gagal memuat detail PR.');
            })
            .finally(() => {
                setDetailLoading(false);
            });
    };

    const loadOutstanding = () => {
        if (outstandingLoading || outstandingList.length > 0) {
            return;
        }
        setOutstandingLoading(true);
        setOutstandingError('');
        fetch('/marketing/purchase-requirement/outstanding', {
            headers: { Accept: 'application/json' },
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Request failed');
                }
                return response.json();
            })
            .then((data) => {
                setOutstandingList(
                    Array.isArray(data?.purchaseRequirements)
                        ? data.purchaseRequirements
                        : []
                );
            })
            .catch(() => {
                setOutstandingError('Gagal memuat data PR outstanding.');
            })
            .finally(() => {
                setOutstandingLoading(false);
            });
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [pageSize, searchTerm, statusFilter]);

    useEffect(() => {
        setOutstandingCurrentPage(1);
    }, [outstandingPageSize, outstandingSearchTerm]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    useEffect(() => {
        if (outstandingCurrentPage > outstandingTotalPages) {
            setOutstandingCurrentPage(outstandingTotalPages);
        }
    }, [outstandingCurrentPage, outstandingTotalPages]);

    useEffect(() => {
        if (isModalOpen) {
            setMaterialSearchTerm('');
            setMaterialPageSize(10);
            setMaterialCurrentPage(1);
        }
    }, [isModalOpen, selectedPr]);

    useEffect(() => {
        if (materialCurrentPage > materialTotalPages) {
            setMaterialCurrentPage(materialTotalPages);
        }
    }, [materialCurrentPage, materialTotalPages]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Purchase Requirement" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Purchase Requirement</h1>
                        <p className="text-sm text-muted-foreground">
                            Ringkasan dan daftar PR
                        </p>
                    </div>
                    <Button
                        type="button"
                        onClick={() =>
                            router.visit('/marketing/purchase-requirement/create')
                        }
                    >
                        Tambah PR
                    </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <button
                        type="button"
                        onClick={() => {
                            setIsOutstandingModalOpen(true);
                            loadOutstanding();
                        }}
                        className="text-left"
                    >
                        <Card className="transition hover:border-primary/60 hover:shadow-md">
                            <CardHeader className="pb-2">
                                <CardDescription>PR Outstanding</CardDescription>
                                <CardTitle className="text-2xl">
                                    {outstandingCount}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground">
                                    Grand total outstanding
                                </p>
                                <p className="text-sm font-semibold">
                                    Rp{' '}
                                    {new Intl.NumberFormat('id-ID').format(
                                        outstandingTotal || 0
                                    )}
                                </p>
                            </CardContent>
                        </Card>
                    </button>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>PR Terealisasi</CardDescription>
                            <CardTitle className="text-2xl">
                                {realizedCount}
                            </CardTitle>
                        </CardHeader>
                    </Card>
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
                                <option value="outstanding">PR Outstanding</option>
                                <option value="realized">PR Terealisasi</option>
                            </select>
                        </label>
                    </div>
                    <label className="text-sm text-muted-foreground">
                        Cari
                        <input
                            type="search"
                            className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
                            placeholder="Cari customer, no PR, ref PO..."
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                        />
                    </label>
                </div>

                <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3 text-left">No PR</th>
                                <th className="px-4 py-3 text-left">Date</th>
                                <th className="px-4 py-3 text-left">Customer</th>
                                <th className="px-4 py-3 text-left">Ref PO</th>
                                <th className="px-4 py-3 text-left">Payment</th>
                                <th className="px-4 py-3 text-left">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedPurchaseRequirements.length === 0 && (
                                <tr>
                                    <td
                                        className="px-4 py-6 text-center text-muted-foreground"
                                        colSpan={6}
                                    >
                                        Belum ada data PR.
                                    </td>
                                </tr>
                            )}
                            {displayedPurchaseRequirements.map((item) => (
                                <tr
                                    key={item.no_pr}
                                    className="border-t border-sidebar-border/70"
                                >
                                    <td className="px-4 py-3">{item.no_pr}</td>
                                    <td className="px-4 py-3">{item.date}</td>
                                    <td className="px-4 py-3">
                                        {item.for_customer}
                                    </td>
                                    <td className="px-4 py-3">{item.ref_po}</td>
                                    <td className="px-4 py-3">
                                        {renderValue(item.payment)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleOpenModal(item)
                                                }
                                                className="text-muted-foreground transition hover:text-foreground"
                                                aria-label="Lihat"
                                                title="Lihat"
                                            >
                                                <Eye className="size-4" />
                                            </button>
                                            <a
                                                href={`/marketing/purchase-requirement/${encodeURIComponent(
                                                    item.no_pr
                                                )}/print`}
                                                className="text-muted-foreground transition hover:text-foreground"
                                                aria-label="Cetak"
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
                            {Math.min((currentPage - 1) * pageSize + 1, totalItems)}
                            -{Math.min(currentPage * pageSize, totalItems)} dari{' '}
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
                            setSelectedPr(null);
                            setSelectedDetails([]);
                            setDetailError('');
                            setDetailLoading(false);
                        }
                    }}
                >
                    <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Detail Purchase Requirement</DialogTitle>
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
                                        <span>{renderValue(selectedPr.no_pr)}</span>
                                    </div>
                                    <div className="grid grid-cols-[150px_1fr] gap-2">
                                        <span className="text-muted-foreground">
                                            Date
                                        </span>
                                        <span>{renderValue(selectedPr.date)}</span>
                                    </div>
                                    <div className="grid grid-cols-[150px_1fr] gap-2">
                                        <span className="text-muted-foreground">
                                            Payment
                                        </span>
                                        <span>
                                            {renderValue(selectedPr.payment)}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-[150px_1fr] gap-2">
                                        <span className="text-muted-foreground">
                                            Customer
                                        </span>
                                        <span>
                                            {renderValue(selectedPr.for_customer)}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-[150px_1fr] gap-2">
                                        <span className="text-muted-foreground">
                                            Ref PO
                                        </span>
                                        <span>{renderValue(selectedPr.ref_po)}</span>
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
                                                className="ml-2 w-64 rounded-md border border-sidebar-border/70 bg-background px-3 py-1 text-sm md:w-80"
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
                                                        Satuan
                                                    </th>
                                                    <th className="px-4 py-3 text-left">
                                                        Sisa PR
                                                    </th>
                                                    <th className="px-4 py-3 text-left">
                                                        Remark
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {displayedMaterialDetails.length ===
                                                    0 && (
                                                    <tr>
                                                        <td
                                                            className="px-4 py-6 text-center text-muted-foreground"
                                                            colSpan={6}
                                                        >
                                                            {detailLoading
                                                                ? 'Memuat detail PR...'
                                                                : detailError ||
                                                                  'Belum ada data material.'}
                                                        </td>
                                                    </tr>
                                                )}
                                                {displayedMaterialDetails.map(
                                                    (detail, index) => (
                                                        <tr
                                                            key={`${detail.no_pr}-${index}`}
                                                            className="border-t border-sidebar-border/70"
                                                        >
                                                            <td className="px-4 py-3">
                                                                {(materialPageSize ===
                                                                Infinity
                                                                    ? index
                                                                    : (materialCurrentPage -
                                                                          1) *
                                                                          materialPageSize +
                                                                      index) + 1}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {getValue(detail, [
                                                                    'material',
                                                                    'Material',
                                                                ])}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {getValue(detail, [
                                                                    'qty',
                                                                    'Qty',
                                                                    'quantity',
                                                                    'Quantity',
                                                                ])}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {getValue(detail, [
                                                                    'satuan',
                                                                    'Satuan',
                                                                    'unit',
                                                                    'Unit',
                                                                ])}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {getValue(detail, [
                                                                    'sisa_pr',
                                                                    'Sisa_pr',
                                                                    'Sisa_PR',
                                                                ])}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {getValue(detail, [
                                                                    'remark',
                                                                    'Remark',
                                                                    'keterangan',
                                                                    'Keterangan',
                                                                ])}
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
                                                        disabled={
                                                            materialCurrentPage === 1
                                                        }
                                                    >
                                                        Sebelumnya
                                                    </Button>
                                                    <span className="text-sm text-muted-foreground">
                                                        Halaman{' '}
                                                        {materialCurrentPage} dari{' '}
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

                <Dialog
                    open={isOutstandingModalOpen}
                    onOpenChange={(open) => {
                        setIsOutstandingModalOpen(open);
                        if (open) {
                            loadOutstanding();
                        } else {
                            setOutstandingSearchTerm('');
                            setOutstandingPageSize(10);
                            setOutstandingCurrentPage(1);
                        }
                    }}
                >
                    <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>PR Outstanding</DialogTitle>
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
                                                : Number(value)
                                        );
                                        setOutstandingCurrentPage(1);
                                    }}
                                >
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
                                        setOutstandingSearchTerm(event.target.value)
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
                                    {displayedOutstandingPurchaseRequirements.length ===
                                        0 && (
                                        <tr>
                                            <td
                                                className="px-4 py-6 text-center text-muted-foreground"
                                                colSpan={5}
                                            >
                                                {outstandingLoading
                                                    ? 'Memuat data PR...'
                                                    : outstandingError ||
                                                      'Tidak ada PR outstanding.'}
                                            </td>
                                        </tr>
                                    )}
                                    {displayedOutstandingPurchaseRequirements.map(
                                        (item) => (
                                            <tr
                                                key={`outstanding-${item.no_pr}`}
                                                className="border-t border-sidebar-border/70"
                                            >
                                                <td className="px-4 py-3">
                                                    {item.no_pr}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {item.date}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {item.for_customer}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {item.ref_po}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Link
                                                        href={`/marketing/purchase-requirement/${encodeURIComponent(
                                                            item.no_pr
                                                        )}/edit`}
                                                        className="text-muted-foreground transition hover:text-foreground"
                                                        aria-label="Edit"
                                                        title="Edit"
                                                    >
                                                        <Pencil className="size-4" />
                                                    </Link>
                                                </td>
                                            </tr>
                                        )
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
                                            outstandingTotalItems
                                        )}
                                        -
                                        {Math.min(
                                            outstandingCurrentPage *
                                                outstandingPageSize,
                                            outstandingTotalItems
                                        )}{' '}
                                        dari {outstandingTotalItems} data
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setOutstandingCurrentPage((page) =>
                                                    Math.max(1, page - 1)
                                                )
                                            }
                                            disabled={outstandingCurrentPage === 1}
                                        >
                                            Sebelumnya
                                        </Button>
                                        <span className="text-sm text-muted-foreground">
                                            Halaman {outstandingCurrentPage} dari{' '}
                                            {outstandingTotalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setOutstandingCurrentPage((page) =>
                                                    Math.min(
                                                        outstandingTotalPages,
                                                        page + 1
                                                    )
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
            </div>
        </AppLayout>
    );
}
