import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router } from '@inertiajs/react';
import { Eye, Pencil, Printer, ReceiptText, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Penjualan', href: '/penjualan/faktur-penjualan' },
    { title: 'Faktur Penjualan', href: '/penjualan/faktur-penjualan' },
];

const toNumber = (value) => {
    const number = Number(value);
    return Number.isNaN(number) ? 0 : number;
};

const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID').format(toNumber(value));

const formatRupiah = (value) => `Rp. ${formatNumber(value)}`;
const parseCurrency = (value) => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return Number.isNaN(value) ? 0 : value;
    const raw = String(value).trim();
    if (!raw) return 0;
    const cleaned = raw.replace(/[^\d,.-]/g, '');
    if (cleaned.includes(',') && cleaned.includes('.')) {
        const normalized = cleaned.replace(/\./g, '').replace(',', '.');
        const number = Number(normalized);
        return Number.isNaN(number) ? 0 : number;
    }
    const normalized = cleaned.replace(',', '.');
    const number = Number(normalized);
    return Number.isNaN(number) ? 0 : number;
};

const formatFakturPajak = (value) => {
    if (value === null || value === undefined) return '';
    const digits = String(value).replace(/\D/g, '');
    if (!digits) return '';
    const part1 = digits.slice(0, 3);
    const part2 = digits.slice(3, 6);
    const part3 = digits.slice(6, 8);
    const rest = digits.slice(8);
    return [part1, part2, part3, rest].filter(Boolean).join('.');
};

const extractInvoiceNo = (value) => {
    if (!value) return '';
    const raw = String(value).trim();
    if (!raw) return '';
    const match = raw.match(/[A-Z]+\.INV-\d+/i);
    if (match) {
        return match[0].toUpperCase();
    }
    const beforeParen = raw.split('(')[0].trim();
    const firstToken = beforeParen.split(/\s+/)[0];
    return firstToken || beforeParen || raw;
};
const parseInvoiceDate = (value) => {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    if (raw.includes('.')) {
        const parts = raw.split('.');
        if (parts.length === 3) {
            const [dd, mm, yyyy] = parts;
            return new Date(
                Number(yyyy),
                Number(mm) - 1,
                Number(dd),
            );
        }
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export default function FakturPenjualanIndex({
    unpaidCount = 0,
    unpaidTotal = 0,
    noReceiptCount = 0,
    noReceiptTotal = 0,
}) {
    const [invoicesData, setInvoicesData] = useState([]);
    const [invoicesLoading, setInvoicesLoading] = useState(false);
    const [invoicesError, setInvoicesError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('unpaid');
    const [noReceiptRange, setNoReceiptRange] = useState('today');

    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');
    const [detailInvoice, setDetailInvoice] = useState(null);
    const [detailItems, setDetailItems] = useState([]);
    const [detailSearch, setDetailSearch] = useState('');
    const [detailPageSize, setDetailPageSize] = useState(5);
    const [detailCurrentPage, setDetailCurrentPage] = useState(1);
    const [isNoReceiptOpen, setIsNoReceiptOpen] = useState(false);
    const [noReceiptPageSize, setNoReceiptPageSize] = useState(10);
    const [noReceiptCurrentPage, setNoReceiptCurrentPage] = useState(1);
    const [noReceiptSearch, setNoReceiptSearch] = useState('');
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [uploadItems, setUploadItems] = useState([]);
    const [uploadFileName, setUploadFileName] = useState('');
    const [uploadSaving, setUploadSaving] = useState(false);
    const [isKwitansiOpen, setIsKwitansiOpen] = useState(false);
    const [kwitansiSaving, setKwitansiSaving] = useState(false);
    const [kwitansiForm, setKwitansiForm] = useState({
        date: new Date().toISOString().slice(0, 10),
        ref_faktur: '',
        customer: '',
        total_price: 0,
    });

    const fetchInvoices = () => {
        setInvoicesLoading(true);
        setInvoicesError('');
        fetch('/penjualan/faktur-penjualan/data', {
            headers: { Accept: 'application/json' },
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Request failed');
                }
                return response.json();
            })
            .then((data) => {
                setInvoicesData(Array.isArray(data?.data) ? data.data : []);
            })
            .catch(() => {
                setInvoicesError('Gagal memuat data faktur.');
            })
            .finally(() => setInvoicesLoading(false));
    };

    const handleDeleteInvoice = (invoice) => {
        // Tutup modal agar overlay Radix tidak menimpa SweetAlert
        setIsNoReceiptOpen(false);
        setIsKwitansiOpen(false);

        Swal.fire({
            title: 'Hapus Invoice?',
            text: `No Invoice: ${invoice.no_fakturpenjualan}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, hapus',
            cancelButtonText: 'Batal',
        }).then((result) => {
            if (!result.isConfirmed) return;
            router.delete(
                `/penjualan/faktur-penjualan/${encodeURIComponent(
                    invoice.no_fakturpenjualan,
                )}`,
                {
                    preserveScroll: true,
                    preserveState: true,
                    onSuccess: () => {
                        setInvoicesData((prev) =>
                            prev.filter(
                                (row) =>
                                    row.no_fakturpenjualan !==
                                    invoice.no_fakturpenjualan,
                            ),
                        );
                    },
                    onError: (errors) => {
                        const message =
                            errors?.message ||
                            (errors &&
                                typeof errors === 'object' &&
                                Object.values(errors)[0]) ||
                            'Gagal menghapus invoice.';
                        Swal.fire({
                            toast: true,
                            position: 'top-end',
                            icon: 'error',
                            title: String(message),
                            showConfirmButton: false,
                            timer: 3000,
                        });
                    },
                },
            );
        });
    };

    useEffect(() => {
        fetchInvoices();
    }, []);

    const filteredInvoices = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        let filtered = invoicesData.filter((item) => {
            if (statusFilter === 'unpaid') {
                return Number(item.total_bayaran ?? 0) === 0;
            }
            if (statusFilter === 'not-received') {
                return item.tgl_terimainv === null || item.tgl_terimainv === '';
            }
            if (statusFilter === 'no-receipt') {
                const value = String(item.no_kwitansi ?? '').trim();
                return value === '' || value.toUpperCase() === 'NULL';
            }
            if (statusFilter === 'due') {
                if (!item.jth_tempo) return false;
                const dueDate = new Date(item.jth_tempo);
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                dueDate.setHours(0, 0, 0, 0);
                return dueDate <= now;
            }
            if (statusFilter === 'not-posted') {
                return String(item.trx_jurnal ?? '') === '1109AD';
            }
            if (statusFilter === 'unpaid-balance') {
                return (
                    toNumber(item.saldo_piutang) > 0 &&
                    toNumber(item.total_bayaran) > 0
                );
            }
            return true;
        });

        if (term) {
            filtered = filtered.filter((item) => {
                return (
                    String(item.no_fakturpenjualan ?? '')
                        .toLowerCase()
                        .includes(term) ||
                    String(item.ref_po ?? '')
                        .toLowerCase()
                        .includes(term) ||
                    String(item.nm_cs ?? '')
                        .toLowerCase()
                        .includes(term)
                );
            });
        }

        if (statusFilter === 'due') {
            filtered = filtered.sort((a, b) => {
                const aDate = new Date(a.jth_tempo ?? 0);
                const bDate = new Date(b.jth_tempo ?? 0);
                return bDate - aDate;
            });
        } else {
            filtered = filtered.sort((a, b) =>
                String(b.no_fakturpenjualan ?? '').localeCompare(
                    String(a.no_fakturpenjualan ?? ''),
                ),
            );
        }

        return filtered;
    }, [invoicesData, searchTerm, statusFilter]);

    const totalItems = filteredInvoices.length;
    const totalPages = useMemo(() => {
        if (pageSize === Infinity) return 1;
        return Math.max(1, Math.ceil(totalItems / pageSize));
    }, [pageSize, totalItems]);

    const displayedInvoices = useMemo(() => {
        if (pageSize === Infinity) return filteredInvoices;
        const startIndex = (currentPage - 1) * pageSize;
        return filteredInvoices.slice(startIndex, startIndex + pageSize);
    }, [filteredInvoices, currentPage, pageSize]);

    useEffect(() => {
        setCurrentPage(1);
    }, [pageSize, searchTerm, statusFilter]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const handleOpenDetail = (item) => {
        const noFaktur = item.no_fakturpenjualan;
        if (!noFaktur) return;
        setIsDetailOpen(true);
        setDetailLoading(true);
        setDetailError('');
        setDetailInvoice(null);
        setDetailItems([]);
        setDetailSearch('');
        setDetailPageSize(5);
        setDetailCurrentPage(1);

        fetch(
            `/penjualan/faktur-penjualan/${encodeURIComponent(
                noFaktur,
            )}/details`,
            {
                headers: { Accept: 'application/json' },
            },
        )
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Request failed');
                }
                return response.json();
            })
            .then((data) => {
                setDetailInvoice(data?.invoice ?? null);
                setDetailItems(Array.isArray(data?.items) ? data.items : []);
            })
            .catch(() => {
                setDetailError('Gagal memuat detail invoice.');
            })
            .finally(() => setDetailLoading(false));
    };

    const filteredDetailItems = useMemo(() => {
        const term = detailSearch.trim().toLowerCase();
        if (!term) return detailItems;
        return detailItems.filter((item) => {
            return (
                String(item.no_do ?? '')
                    .toLowerCase()
                    .includes(term) ||
                String(item.material ?? '')
                    .toLowerCase()
                    .includes(term)
            );
        });
    }, [detailItems, detailSearch]);

    const detailTotalItems = filteredDetailItems.length;
    const detailTotalPages = useMemo(() => {
        if (detailPageSize === Infinity) return 1;
        return Math.max(1, Math.ceil(detailTotalItems / detailPageSize));
    }, [detailPageSize, detailTotalItems]);

    const displayedDetailItems = useMemo(() => {
        if (detailPageSize === Infinity) return filteredDetailItems;
        const startIndex = (detailCurrentPage - 1) * detailPageSize;
        return filteredDetailItems.slice(startIndex, startIndex + detailPageSize);
    }, [filteredDetailItems, detailCurrentPage, detailPageSize]);

    useEffect(() => {
        setDetailCurrentPage(1);
    }, [detailPageSize, detailSearch]);

    useEffect(() => {
        if (detailCurrentPage > detailTotalPages) {
            setDetailCurrentPage(detailTotalPages);
        }
    }, [detailCurrentPage, detailTotalPages]);

    const detailHargaPokok = useMemo(() => {
        if (!detailInvoice) return 0;
        return toNumber(detailInvoice.HPP) + toNumber(detailInvoice.HPPDOT);
    }, [detailInvoice]);

    const detailTotalPrice = useMemo(() => {
        if (!detailInvoice) return 0;
        return toNumber(detailInvoice.g_total);
    }, [detailInvoice]);

    const detailMargin = useMemo(() => {
        if (!detailTotalPrice) return 0;
        return ((detailTotalPrice - detailHargaPokok) / detailTotalPrice) * 100;
    }, [detailTotalPrice, detailHargaPokok]);

    const detailSaldoPiutang = useMemo(() => {
        if (!detailInvoice) return 0;
        return toNumber(detailInvoice.saldo_piutang);
    }, [detailInvoice]);

    const detailTotalBayar = useMemo(() => {
        if (!detailInvoice) return 0;
        return toNumber(detailInvoice.total_bayaran);
    }, [detailInvoice]);


    const parseCsvLine = (line, delimiter) => {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i += 1) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i += 1;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }

            if (char === delimiter && !inQuotes) {
                result.push(current);
                current = '';
                continue;
            }
            current += char;
        }
        result.push(current);
        return result;
    };

    const handleUploadCsv = (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        setIsUploadOpen(true);
        setUploadLoading(true);
        setUploadError('');
        setUploadItems([]);
        setUploadFileName(file.name);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = String(e.target.result ?? '');
                const lines = text
                    .replace(/^\uFEFF/, '')
                    .split(/\r?\n/)
                    .filter((line) => line !== '');
                const headerLine = lines[0] ?? '';
                const delimiter = headerLine.includes(';')
                    ? ';'
                    : headerLine.includes('\t')
                      ? '\t'
                      : ',';
                const parsed = [];

                for (let i = 1; i < lines.length; i += 1) {
                    const row = parseCsvLine(lines[i], delimiter);
                    const fakturPajak = row?.[3] ?? '';
                    const referensi = row?.[14] ?? '';
                    if (!fakturPajak && !referensi) {
                        continue;
                    }
                    const invoiceNo = extractInvoiceNo(referensi);
                    if (!invoiceNo) {
                        continue;
                    }
                    parsed.push({
                        no_fakturpenjualan: invoiceNo,
                        no_fakturpajak: formatFakturPajak(fakturPajak),
                        referensi: referensi,
                    });
                }

                setUploadItems(parsed);
            } catch (error) {
                setUploadError('Gagal membaca file CSV.');
            } finally {
                setUploadLoading(false);
                event.target.value = '';
            }
        };
        reader.onerror = () => {
            setUploadError('Gagal membaca file CSV.');
            setUploadLoading(false);
            event.target.value = '';
        };
        reader.readAsText(file);
    };

    const handleSaveUpload = () => {
        if (uploadSaving || uploadItems.length === 0) return;
        setUploadSaving(true);
        fetch('/penjualan/faktur-penjualan/upload-faktur-pajak', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify({
                items: uploadItems.map((item) => ({
                    no_fakturpenjualan: item.no_fakturpenjualan,
                    no_fakturpajak: item.no_fakturpajak,
                })),
            }),
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Request failed');
                }
                return response.json();
            })
            .then(() => {
                setIsUploadOpen(false);
                setUploadItems([]);
                setUploadFileName('');
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Faktur pajak berhasil disimpan.',
                    showConfirmButton: false,
                    timer: 3000,
                });
            })
            .catch(() => {
                setUploadError('Gagal menyimpan faktur pajak.');
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'error',
                    title: 'Gagal menyimpan faktur pajak.',
                    showConfirmButton: false,
                    timer: 3500,
                });
            })
            .finally(() => setUploadSaving(false));
    };

    const openKwitansiModal = (item) => {
        setKwitansiForm({
            date: new Date().toISOString().slice(0, 10),
            ref_faktur: item.no_fakturpenjualan ?? '',
            customer: item.nm_cs ?? '',
            total_price: item.g_total ?? 0,
        });
        setIsKwitansiOpen(true);
    };

    const handleSaveKwitansi = () => {
        if (kwitansiSaving) return;
        setKwitansiSaving(true);
        fetch('/penjualan/faktur-penjualan/kwitansi', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify(kwitansiForm),
        })
            .then(async (response) => {
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data?.message || 'Request failed');
                }
                return data;
            })
            .then(() => {
                setIsKwitansiOpen(false);
                fetchInvoices();
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Kwitansi berhasil disimpan.',
                    showConfirmButton: false,
                    timer: 3000,
                });
            })
            .catch((error) => {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'error',
                    title: error?.message || 'Gagal menyimpan kwitansi.',
                    showConfirmButton: false,
                    timer: 3500,
                });
            })
            .finally(() => setKwitansiSaving(false));
    };

    const noReceiptSummary = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const startOfDay = new Date(now);
        const startOfWeek = new Date(now);
        const dayIndex = (startOfWeek.getDay() + 6) % 7;
        startOfWeek.setDate(startOfWeek.getDate() - dayIndex);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        const isNoReceipt = (item) => {
            const value = String(item.no_kwitansi ?? '').trim();
            return value === '' || value.toUpperCase() === 'NULL';
        };

        const isInRange = (dateValue) => {
            if (!dateValue) return false;
            const date = parseInvoiceDate(dateValue);
            if (!date) return false;
            date.setHours(0, 0, 0, 0);
            if (noReceiptRange === 'today') return date >= startOfDay;
            if (noReceiptRange === 'week') return date >= startOfWeek;
            if (noReceiptRange === 'month') return date >= startOfMonth;
            if (noReceiptRange === 'year') return date >= startOfYear;
            return true;
        };

        const filtered = invoicesData.filter(
            (item) => isNoReceipt(item) && isInRange(item.tgl_doc),
        );

        return {
            count: filtered.length,
            total: filtered.reduce(
                (sum, item) => sum + parseCurrency(item.g_total),
                0,
            ),
            items: filtered,
        };
    }, [invoicesData, noReceiptRange]);

    const filteredNoReceiptItems = useMemo(() => {
        const term = noReceiptSearch.trim().toLowerCase();
        let filtered = noReceiptSummary.items;
        if (term) {
            filtered = filtered.filter((item) => {
                return (
                    String(item.no_fakturpenjualan ?? '')
                        .toLowerCase()
                        .includes(term) ||
                    String(item.ref_po ?? '')
                        .toLowerCase()
                        .includes(term) ||
                    String(item.nm_cs ?? '')
                        .toLowerCase()
                        .includes(term)
                );
            });
        }
        return filtered.sort((a, b) =>
            String(b.no_fakturpenjualan ?? '').localeCompare(
                String(a.no_fakturpenjualan ?? ''),
            ),
        );
    }, [noReceiptSummary.items, noReceiptSearch]);

    const noReceiptTotalItems = filteredNoReceiptItems.length;
    const noReceiptTotalPages = useMemo(() => {
        if (noReceiptPageSize === Infinity) return 1;
        return Math.max(1, Math.ceil(noReceiptTotalItems / noReceiptPageSize));
    }, [noReceiptPageSize, noReceiptTotalItems]);

    const displayedNoReceiptItems = useMemo(() => {
        if (noReceiptPageSize === Infinity) return filteredNoReceiptItems;
        const startIndex = (noReceiptCurrentPage - 1) * noReceiptPageSize;
        return filteredNoReceiptItems.slice(
            startIndex,
            startIndex + noReceiptPageSize,
        );
    }, [filteredNoReceiptItems, noReceiptCurrentPage, noReceiptPageSize]);

    useEffect(() => {
        setNoReceiptCurrentPage(1);
    }, [noReceiptPageSize, noReceiptSearch, noReceiptRange]);

    useEffect(() => {
        if (noReceiptCurrentPage > noReceiptTotalPages) {
            setNoReceiptCurrentPage(noReceiptTotalPages);
        }
    }, [noReceiptCurrentPage, noReceiptTotalPages]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Faktur Penjualan" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">
                            Faktur Penjualan
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Ringkasan faktur penjualan.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-sidebar-border/70 bg-black px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/90">
                            <input
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={handleUploadCsv}
                            />
                            Upload Faktur Pajak
                        </label>
                        <Button asChild>
                            <Link href="/penjualan/faktur-penjualan/create">
                                Tambah Invoice
                            </Link>
                        </Button>
                    </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <Card className="flex flex-col transition hover:border-primary/60 hover:shadow-md">
                        <CardHeader className="space-y-1 pb-2">
                            <CardTitle>Invoice Belum Dibayar</CardTitle>
                            <CardDescription>
                                Total invoice dengan pembayaran 0.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-1 pt-2">
                            <p className="text-3xl font-semibold">
                                {formatNumber(unpaidCount)} Invoice
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Grand Total: {formatRupiah(unpaidTotal)}
                            </p>
                        </CardContent>
                    </Card>
                    <Card
                        className="flex cursor-pointer flex-col transition hover:border-primary/60 hover:shadow-md"
                        onClick={() => setIsNoReceiptOpen(true)}
                    >
                        <CardHeader className="space-y-1 pb-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <CardTitle>Invoice Belum Bikin Kwitansi</CardTitle>
                                <select
                                    className="h-8 rounded-md border border-sidebar-border/70 bg-background px-2 text-xs text-muted-foreground"
                                    value={noReceiptRange}
                                    onChange={(event) =>
                                        setNoReceiptRange(event.target.value)
                                    }
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <option value="today">Hari ini</option>
                                    <option value="week">Minggu ini</option>
                                    <option value="month">Bulan ini</option>
                                    <option value="year">Tahun ini</option>
                                    <option value="all">Semua data</option>
                                </select>
                            </div>
                            <CardDescription>
                                Invoice tanpa nomor kwitansi.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-1 pt-2">
                            <p className="text-3xl font-semibold">
                                {formatNumber(noReceiptSummary.count)} Invoice
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Grand Total: {formatRupiah(noReceiptSummary.total)}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <CardTitle>Daftar Faktur</CardTitle>
                                <CardDescription>
                                    Data faktur penjualan.
                                </CardDescription>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <select
                                className="h-9 rounded-md border border-sidebar-border/70 bg-background px-3 text-sm"
                                value={
                                    pageSize === Infinity ? 'all' : pageSize
                                }
                                onChange={(event) => {
                                    const value = event.target.value;
                                    setPageSize(
                                        value === 'all' ? Infinity : Number(value),
                                    );
                                }}
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value="all">Semua</option>
                            </select>
                            <select
                                className="h-9 rounded-md border border-sidebar-border/70 bg-background px-3 text-sm"
                                value={statusFilter}
                                onChange={(event) =>
                                    setStatusFilter(event.target.value)
                                }
                            >
                                <option value="unpaid">
                                    Invoice belum dibayar
                                </option>
                                <option value="not-received">
                                    Invoice belum diterima user
                                </option>
                                <option value="no-receipt">
                                    Invoice belum dibikin kwitansi
                                </option>
                                <option value="not-posted">
                                    Invoice belum dibukukan
                                </option>
                                <option value="unpaid-balance">
                                    Invoice belum lunas
                                </option>
                                <option value="all">Semua invoice</option>
                            </select>
                            <Input
                                placeholder="Cari no invoice, ref po, customer..."
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                className="min-w-[220px]"
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>No Invoice</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Ref PO</TableHead>
                                        <TableHead className="text-right">
                                            Aksi
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {invoicesLoading && (
                                        <TableRow>
                                            <TableCell colSpan={5}>
                                                Memuat data invoice...
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {!invoicesLoading && invoicesError && (
                                        <TableRow>
                                            <TableCell colSpan={5}>
                                                {invoicesError}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {!invoicesLoading &&
                                        !invoicesError &&
                                        displayedInvoices.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5}>
                                                Tidak ada data invoice.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {!invoicesLoading &&
                                        !invoicesError &&
                                        displayedInvoices.map((item) => (
                                        <TableRow
                                            key={`inv-${item.no_fakturpenjualan}`}
                                        >
                                            <TableCell>
                                                {item.no_fakturpenjualan}
                                            </TableCell>
                                            <TableCell>{item.tgl_doc}</TableCell>
                                            <TableCell>{item.nm_cs}</TableCell>
                                            <TableCell>{item.ref_po}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() =>
                                                            handleOpenDetail(item)
                                                        }
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button asChild variant="ghost" size="icon">
                                                        <a
                                                            href={`/penjualan/faktur-penjualan/${encodeURIComponent(
                                                                item.no_fakturpenjualan ?? '',
                                                            )}/print`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                        >
                                                            <Printer className="h-4 w-4" />
                                                        </a>
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {pageSize !== Infinity && totalItems > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                <span>
                                    Menampilkan{' '}
                                    {(currentPage - 1) * pageSize + 1} -{' '}
                                    {Math.min(currentPage * pageSize, totalItems)}{' '}
                                    dari {totalItems} data
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
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
                                    <span>
                                        Halaman {currentPage} dari {totalPages}
                                    </span>
                                    <Button
                                        type="button"
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
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto">
                    <DialogHeader className="px-6 pt-6">
                        <DialogTitle>Detail Invoice</DialogTitle>
                        <DialogDescription className="sr-only">
                            Detail invoice dan daftar DO.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-6 px-6 pb-6">
                        {detailLoading && (
                            <p className="text-sm text-muted-foreground">
                                Memuat detail invoice...
                            </p>
                        )}
                        {detailError && (
                            <p className="text-sm text-destructive">
                                {detailError}
                            </p>
                        )}
                        {detailInvoice && (
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between gap-4">
                                        <span className="text-muted-foreground">
                                            No Invoice
                                        </span>
                                        <span>
                                            {detailInvoice.no_fakturpenjualan}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-muted-foreground">
                                            Date
                                        </span>
                                        <span>{detailInvoice.tgl_doc}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-muted-foreground">
                                            Customer
                                        </span>
                                        <span>{detailInvoice.nm_cs}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-muted-foreground">
                                            Ref PO
                                        </span>
                                        <span>{detailInvoice.ref_po}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-muted-foreground">
                                            No Faktur Pajak
                                        </span>
                                        <span>{detailInvoice.no_fakturpajak ?? '-'}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-muted-foreground">PPN</span>
                                        <span>{detailInvoice.ppn}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-muted-foreground">
                                            Price
                                        </span>
                                        <span>
                                            {formatRupiah(detailInvoice.harga)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-muted-foreground">
                                            Harga PPN
                                        </span>
                                        <span>
                                            {formatRupiah(detailInvoice.h_ppn)}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between gap-4">
                                        <span className="text-muted-foreground">
                                            Total Price
                                        </span>
                                        <span>
                                            {formatRupiah(detailInvoice.g_total)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-muted-foreground">
                                            Tanggal Terima Invoice
                                        </span>
                                        <span>
                                            {detailInvoice.tgl_terimainv ?? '-'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-muted-foreground">
                                            Tanggal Bayar
                                        </span>
                                        <span>
                                            {detailInvoice.tgl_bayar ?? '-'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-muted-foreground">
                                            Jatuh Tempo
                                        </span>
                                        <span>{detailInvoice.jth_tempo}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-muted-foreground">
                                            Saldo Piutang/Sisa Bayar
                                        </span>
                                        <span>
                                            {formatRupiah(detailSaldoPiutang)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-muted-foreground">
                                            Total Bayar
                                        </span>
                                        <span>{formatRupiah(detailTotalBayar)}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-muted-foreground">
                                            Harga Pembelian Pokok
                                        </span>
                                        <span>{formatRupiah(detailHargaPokok)}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-muted-foreground">
                                            Margin
                                        </span>
                                        <span>{formatNumber(detailMargin)}%</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <select
                                    className="h-9 rounded-md border border-sidebar-border/70 bg-background px-3 text-sm"
                                    value={
                                        detailPageSize === Infinity
                                            ? 'all'
                                            : detailPageSize
                                    }
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setDetailPageSize(
                                            value === 'all'
                                                ? Infinity
                                                : Number(value),
                                        );
                                    }}
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value="all">Semua</option>
                                </select>
                                <Input
                                    placeholder="Cari no DO atau material..."
                                    value={detailSearch}
                                    onChange={(event) =>
                                        setDetailSearch(event.target.value)
                                    }
                                />
                            </div>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>No DO</TableHead>
                                            <TableHead>Material</TableHead>
                                            <TableHead>Qty</TableHead>
                                            <TableHead>Satuan</TableHead>
                                            <TableHead>Price</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {displayedDetailItems.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5}>
                                                    Tidak ada data DO.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {displayedDetailItems.map((item, index) => (
                                            <TableRow
                                                key={`detail-${item.no_do}-${index}`}
                                            >
                                                <TableCell>{item.no_do}</TableCell>
                                                <TableCell>{item.material}</TableCell>
                                                <TableCell>{item.qty}</TableCell>
                                                <TableCell>{item.unit}</TableCell>
                                                <TableCell>
                                                    {formatRupiah(item.ttl_price)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            {detailPageSize !== Infinity &&
                                detailTotalItems > 0 && (
                                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                        <span>
                                            Menampilkan{' '}
                                            {(detailCurrentPage - 1) *
                                                detailPageSize +
                                                1}{' '}
                                            -{' '}
                                            {Math.min(
                                                detailCurrentPage * detailPageSize,
                                                detailTotalItems,
                                            )}{' '}
                                            dari {detailTotalItems} data
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    setDetailCurrentPage(
                                                        (page) => Math.max(1, page - 1),
                                                    )
                                                }
                                                disabled={detailCurrentPage === 1}
                                            >
                                                Sebelumnya
                                            </Button>
                                            <span>
                                                Halaman {detailCurrentPage} dari{' '}
                                                {detailTotalPages}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    setDetailCurrentPage((page) =>
                                                        Math.min(
                                                            detailTotalPages,
                                                            page + 1,
                                                        ),
                                                    )
                                                }
                                                disabled={
                                                    detailCurrentPage === detailTotalPages
                                                }
                                            >
                                                Berikutnya
                                            </Button>
                                        </div>
                                    </div>
                                )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isNoReceiptOpen} onOpenChange={setIsNoReceiptOpen}>
                <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto">
                    <DialogHeader className="px-6 pt-6">
                        <DialogTitle>Invoice Belum Bikin Kwitansi</DialogTitle>
                        <DialogDescription className="sr-only">
                            Daftar invoice tanpa kwitansi.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-6 px-6 pb-6">
                        <div className="flex flex-wrap items-center gap-3">
                            <select
                                className="h-9 rounded-md border border-sidebar-border/70 bg-background px-3 text-sm"
                                value={
                                    noReceiptPageSize === Infinity
                                        ? 'all'
                                        : noReceiptPageSize
                                }
                                onChange={(event) => {
                                    const value = event.target.value;
                                    setNoReceiptPageSize(
                                        value === 'all' ? Infinity : Number(value),
                                    );
                                }}
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value="all">Semua</option>
                            </select>
                            <Input
                                placeholder="Cari no invoice, ref po, customer..."
                                value={noReceiptSearch}
                                onChange={(event) =>
                                    setNoReceiptSearch(event.target.value)
                                }
                            />
                        </div>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>No Invoice</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Ref PO</TableHead>
                                        <TableHead>Total Price</TableHead>
                                        <TableHead className="text-right">
                                            Aksi
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayedNoReceiptItems.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6}>
                                                Tidak ada data invoice.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {displayedNoReceiptItems.map((item) => (
                                        <TableRow
                                            key={`no-receipt-${item.no_fakturpenjualan}`}
                                        >
                                            <TableCell>
                                                {item.no_fakturpenjualan}
                                            </TableCell>
                                            <TableCell>{item.tgl_doc}</TableCell>
                                            <TableCell>{item.nm_cs}</TableCell>
                                            <TableCell>{item.ref_po}</TableCell>
                                            <TableCell>
                                                {formatRupiah(item.g_total)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="inline-flex items-center justify-end gap-2">
                                                    <Link
                                                        href={`/penjualan/faktur-penjualan/${encodeURIComponent(
                                                            item.no_fakturpenjualan ?? '',
                                                        )}/edit`}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:text-foreground"
                                                        aria-label="Edit INV"
                                                        title="Edit INV"
                                                        onClick={() => {
                                                            setIsNoReceiptOpen(false);
                                                            setIsKwitansiOpen(false);
                                                        }}
                                                    >
                                                        <Pencil className="size-4" />
                                                    </Link>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() =>
                                                            openKwitansiModal(item)
                                                        }
                                                        aria-label="Buat Kwitansi"
                                                        title="Buat Kwitansi"
                                                    >
                                                        <ReceiptText className="h-4 w-4" />
                                                    </Button>
                                                    <button
                                                        type="button"
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-destructive transition hover:text-red-600"
                                                        aria-label="Hapus Invoice"
                                                        title="Hapus Invoice"
                                                        onClick={() => handleDeleteInvoice(item)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        {noReceiptPageSize !== Infinity &&
                            noReceiptTotalItems > 0 && (
                                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                    <span>
                                        Menampilkan{' '}
                                        {(noReceiptCurrentPage - 1) *
                                            noReceiptPageSize +
                                            1}{' '}
                                        -{' '}
                                        {Math.min(
                                            noReceiptCurrentPage * noReceiptPageSize,
                                            noReceiptTotalItems,
                                        )}{' '}
                                        dari {noReceiptTotalItems} data
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setNoReceiptCurrentPage((page) =>
                                                    Math.max(1, page - 1),
                                                )
                                            }
                                            disabled={noReceiptCurrentPage === 1}
                                        >
                                            Sebelumnya
                                        </Button>
                                        <span>
                                            Halaman {noReceiptCurrentPage} dari{' '}
                                            {noReceiptTotalPages}
                                        </span>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setNoReceiptCurrentPage((page) =>
                                                    Math.min(
                                                        noReceiptTotalPages,
                                                        page + 1,
                                                    ),
                                                )
                                            }
                                            disabled={
                                                noReceiptCurrentPage ===
                                                noReceiptTotalPages
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

            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto">
                    <DialogHeader className="px-6 pt-6">
                        <DialogTitle>Upload Faktur Pajak</DialogTitle>
                        <DialogDescription className="sr-only">
                            Unggah CSV faktur pajak untuk diperbarui.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-6 px-6 pb-6">
                        <div className="text-sm text-muted-foreground">
                            {uploadFileName
                                ? `File: ${uploadFileName}`
                                : 'Pilih file CSV untuk diproses.'}
                        </div>
                        {uploadLoading && (
                            <div className="text-sm text-muted-foreground">
                                Memproses file CSV...
                            </div>
                        )}
                        {uploadError && (
                            <div className="text-sm text-destructive">
                                {uploadError}
                            </div>
                        )}
                        {!uploadLoading && uploadItems.length > 0 && (
                            <div className="space-y-4">
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>No Invoice</TableHead>
                                                <TableHead>Nomor Faktur Pajak</TableHead>
                                                <TableHead>Referensi</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {uploadItems.map((item, index) => (
                                                <TableRow
                                                    key={`upload-${item.no_fakturpenjualan}-${index}`}
                                                >
                                                    <TableCell>
                                                        {item.no_fakturpenjualan}
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.no_fakturpajak}
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.referensi}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                <div className="flex justify-end">
                                    <Button
                                        type="button"
                                        onClick={handleSaveUpload}
                                        disabled={uploadSaving}
                                    >
                                        {uploadSaving
                                            ? 'Menyimpan...'
                                            : 'Simpan'}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isKwitansiOpen} onOpenChange={setIsKwitansiOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Buat Kwitansi</DialogTitle>
                        <DialogDescription className="sr-only">
                            Form pembuatan kwitansi dari invoice.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <label className="space-y-2 text-sm">
                            <span className="text-muted-foreground">Date</span>
                            <Input
                                type="date"
                                value={kwitansiForm.date}
                                onChange={(event) =>
                                    setKwitansiForm((prev) => ({
                                        ...prev,
                                        date: event.target.value,
                                    }))
                                }
                            />
                        </label>
                        <label className="space-y-2 text-sm">
                            <span className="text-muted-foreground">
                                No Invoice
                            </span>
                            <Input value={kwitansiForm.ref_faktur} readOnly />
                        </label>
                        <label className="space-y-2 text-sm">
                            <span className="text-muted-foreground">Customer</span>
                            <Input value={kwitansiForm.customer} readOnly />
                        </label>
                        <label className="space-y-2 text-sm">
                            <span className="text-muted-foreground">
                                Total Price
                            </span>
                            <Input
                                value={formatRupiah(kwitansiForm.total_price)}
                                readOnly
                            />
                        </label>
                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                onClick={handleSaveKwitansi}
                                disabled={kwitansiSaving}
                            >
                                {kwitansiSaving ? 'Menyimpan...' : 'Simpan'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
