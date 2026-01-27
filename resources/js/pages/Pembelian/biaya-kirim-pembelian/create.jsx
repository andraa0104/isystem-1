import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Swal from 'sweetalert2';

const PAGE_SIZE_OPTIONS = [
    { value: '5', label: '5' },
    { value: '10', label: '10' },
    { value: '25', label: '25' },
    { value: '50', label: '50' },
    { value: 'all', label: 'Semua data' },
];

const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value ?? 0);
const formatRupiah = (value) => `Rp ${formatNumber(value)}`;
const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;
const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(date);
};

export default function BiayaKirimPembelianCreate() {
    const [poModalOpen, setPoModalOpen] = useState(false);
    const [poRows, setPoRows] = useState([]);
    const [poSearch, setPoSearch] = useState('');
    const [poPageSize, setPoPageSize] = useState(5);
    const [poLoading, setPoLoading] = useState(false);
    const [poCurrentPage, setPoCurrentPage] = useState(1);

    const [selectedPos, setSelectedPos] = useState([]);
    const [selectedPo, setSelectedPo] = useState(null);
    const [materialRows, setMaterialRows] = useState([]);
    const [materialSearch, setMaterialSearch] = useState('');
    const [materialPageSize, setMaterialPageSize] = useState(5);
    const [materialCurrentPage, setMaterialCurrentPage] = useState(1);

    const [fieldNoPo, setFieldNoPo] = useState('');
    const [fieldDate, setFieldDate] = useState('');
    const [fieldRefPoIn, setFieldRefPoIn] = useState('');
    const [fieldCustomer, setFieldCustomer] = useState('');
    const [fieldKdVdr, setFieldKdVdr] = useState('');
    const [fieldNmVdr, setFieldNmVdr] = useState('');
    const [fieldKdMat, setFieldKdMat] = useState('');
    const [fieldMat, setFieldMat] = useState('');
    const [fieldQty, setFieldQty] = useState('');
    const [fieldUnit, setFieldUnit] = useState('');
    const [fieldPrice, setFieldPrice] = useState('');
    const [fieldTotalPrice, setFieldTotalPrice] = useState('');

    const [bkpRows, setBkpRows] = useState([]);

    const fetchPoRows = async () => {
        setPoLoading(true);
        try {
            const params = new URLSearchParams({
                search: poSearch,
                pageSize: poPageSize === Infinity ? 'all' : String(poPageSize),
            });
            const res = await fetch(`/pembelian/biaya-kirim-pembelian/po-list?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
            const data = await res.json();
            setPoRows(Array.isArray(data?.rows) ? data.rows : []);
        } finally {
            setPoLoading(false);
        }
    };

    useEffect(() => {
        if (!poModalOpen) return;
        fetchPoRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [poModalOpen, poSearch, poPageSize]);

    const poTotalPages = useMemo(() => {
        if (poPageSize === Infinity) return 1;
        const size = poPageSize || 5;
        return Math.max(1, Math.ceil(poRows.length / size));
    }, [poRows.length, poPageSize]);

    const sortedPoRows = useMemo(() => {
        return [...poRows].sort((a, b) =>
            String(b.no_po ?? '').localeCompare(String(a.no_po ?? ''))
        );
    }, [poRows]);

    const displayedPoRows = useMemo(() => {
        if (poPageSize === Infinity) return sortedPoRows;
        const size = poPageSize || 5;
        const start = (poCurrentPage - 1) * size;
        return sortedPoRows.slice(start, start + size);
    }, [sortedPoRows, poPageSize, poCurrentPage]);

    const filteredMaterials = useMemo(() => {
        const term = materialSearch.trim().toLowerCase();
        if (!term) return materialRows;
        return materialRows.filter((row) =>
            String(row.material ?? '').toLowerCase().includes(term)
        );
    }, [materialRows, materialSearch]);

    const materialTotalPages = useMemo(() => {
        if (materialPageSize === Infinity) return 1;
        const size = materialPageSize || 5;
        return Math.max(1, Math.ceil(filteredMaterials.length / size));
    }, [filteredMaterials.length, materialPageSize]);

    const displayedMaterials = useMemo(() => {
        if (materialPageSize === Infinity) return filteredMaterials;
        const size = materialPageSize || 5;
        const start = (materialCurrentPage - 1) * size;
        return filteredMaterials.slice(start, start + size);
    }, [filteredMaterials, materialPageSize, materialCurrentPage]);

    const handleSelectPo = async (row) => {
        if (!row?.no_po) return;
        const exists = selectedPos.some((item) => item.no_po === row.no_po);
        if (!exists) {
            setSelectedPos((prev) => [...prev, row]);
        }
        setSelectedPo(row);
        setFieldNoPo(row.no_po ?? '');
        setFieldDate(row.tgl ?? '');
        setFieldRefPoIn(row.ref_poin ?? '');
        setFieldCustomer(row.for_cus ?? '');
        setFieldKdVdr(row.kd_vdr ?? '');
        setFieldNmVdr(row.nm_vdr ?? '');

        const res = await fetch(`/pembelian/biaya-kirim-pembelian/po-materials?no_po=${encodeURIComponent(row.no_po)}`, {
            headers: { Accept: 'application/json' },
        });
        const data = await res.json();
        setMaterialRows(Array.isArray(data?.rows) ? data.rows : []);
        setMaterialSearch('');
        setMaterialPageSize(5);
        setMaterialCurrentPage(1);
    };

    const handleSelectMaterial = (row) => {
        setFieldKdMat(row.kd_mat ?? '');
        setFieldMat(row.material ?? '');
        setFieldQty(row.qty ?? '');
        setFieldUnit(row.unit ?? '');
        setFieldPrice(row.price ?? '');
        setFieldTotalPrice(row.total_price ?? '');
    };

    const handleAddBkpRow = () => {
        if (!fieldNoPo || !fieldKdMat) return;
        const exists = bkpRows.some(
            (row) => String(row.no_po) === String(fieldNoPo) && String(row.kd_mat) === String(fieldKdMat)
        );
        if (exists) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'warning',
                title: 'Data sudah ada (No PO & Kode Material)',
                showConfirmButton: false,
                timer: 2500,
                timerProgressBar: true,
            });
            return;
        }
        setBkpRows((prev) => [
            ...prev,
            {
                no_po: fieldNoPo,
                kd_mat: fieldKdMat,
                material: fieldMat,
                qty: fieldQty,
                unit: fieldUnit,
                price: fieldPrice,
                total_price: fieldTotalPrice,
            },
        ]);
        setFieldKdMat('');
        setFieldMat('');
        setFieldQty('');
        setFieldUnit('');
        setFieldPrice('');
        setFieldTotalPrice('');
    };

    return (
        <AppLayout breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Biaya Kirim Pembelian', href: '/pembelian/biaya-kirim-pembelian' }, { title: 'Create', href: '/pembelian/biaya-kirim-pembelian/create' }]}>
            <Head title="Create Biaya Kirim Pembelian" />
            <div className="flex flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center gap-3">
                    <Button variant="default" onClick={() => setPoModalOpen(true)}>
                        Cari PO
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Data PO</CardTitle>
                    </CardHeader>
                    <CardContent className="w-full overflow-x-auto">
                        <Table className="min-w-[900px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[60px]">No</TableHead>
                                    <TableHead>No PO</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Ref PO In</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Kode Vendor</TableHead>
                                    <TableHead>Vendor</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedPos.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                                            Belum ada data PO.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    selectedPos.map((row, idx) => (
                                        <TableRow
                                            key={`${row.no_po}-${idx}`}
                                            className={`cursor-pointer ${selectedPo?.no_po === row.no_po ? 'bg-muted/30' : ''}`}
                                            onClick={() => handleSelectPo(row)}
                                        >
                                            <TableCell>{idx + 1}</TableCell>
                                            <TableCell>{renderValue(row.no_po)}</TableCell>
                                            <TableCell>{formatDate(row.tgl)}</TableCell>
                                            <TableCell>{renderValue(row.ref_poin)}</TableCell>
                                            <TableCell>{renderValue(row.for_cus)}</TableCell>
                                            <TableCell>{renderValue(row.kd_vdr)}</TableCell>
                                            <TableCell>{renderValue(row.nm_vdr)}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>


                <Card>
                    <CardHeader>
                        <CardTitle>Material In PO</CardTitle>
                    </CardHeader>
                    <CardContent className="w-full overflow-x-auto">
                        <div className="flex flex-wrap items-center gap-2 pb-3">
                            <Input
                                placeholder="Cari material..."
                                value={materialSearch}
                                onChange={(e) => setMaterialSearch(e.target.value)}
                                className="w-full sm:w-64"
                            />
                            <Select
                                value={materialPageSize === Infinity ? 'all' : String(materialPageSize)}
                                onValueChange={(value) => {
                                    if (value === 'all') {
                                        setMaterialPageSize(Infinity);
                                    } else {
                                        const parsed = Number(value);
                                        setMaterialPageSize(Number.isNaN(parsed) ? 5 : parsed);
                                    }
                                    setMaterialCurrentPage(1);
                                }}
                            >
                                <SelectTrigger className="w-full sm:w-[160px]">
                                    <SelectValue placeholder="Tampil" />
                                </SelectTrigger>
                                <SelectContent>
                                    {PAGE_SIZE_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Table className="min-w-[900px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[60px]">No</TableHead>
                                    <TableHead>Kode Material</TableHead>
                                    <TableHead>Material</TableHead>
                                    <TableHead>Qty</TableHead>
                                    <TableHead>Satuan</TableHead>
                                    <TableHead>Price</TableHead>
                                    <TableHead>Total Price</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {displayedMaterials.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                                            Tidak ada data.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    displayedMaterials.map((row, idx) => (
                                        <TableRow
                                            key={`${row.kd_mat}-${idx}`}
                                            className="cursor-pointer"
                                            onClick={() => handleSelectMaterial(row)}
                                        >
                                            <TableCell>{idx + 1 + (materialPageSize === Infinity ? 0 : (materialCurrentPage - 1) * materialPageSize)}</TableCell>
                                            <TableCell>{renderValue(row.kd_mat)}</TableCell>
                                            <TableCell>{renderValue(row.material)}</TableCell>
                                            <TableCell>{renderValue(row.qty)}</TableCell>
                                            <TableCell>{renderValue(row.unit)}</TableCell>
                                            <TableCell>{formatRupiah(row.price)} ({renderValue(row.price)})</TableCell>
                                            <TableCell>{formatRupiah(row.total_price)} ({renderValue(row.total_price)})</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 text-sm">
                            <div className="text-muted-foreground">Total data: {filteredMaterials.length}</div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setMaterialCurrentPage((prev) => Math.max(1, prev - 1))}
                                    disabled={materialCurrentPage === 1 || materialPageSize === Infinity}
                                >
                                    Sebelumnya
                                </Button>
                                <span>
                                    Halaman {materialCurrentPage} / {materialTotalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setMaterialCurrentPage((prev) => Math.min(materialTotalPages, prev + 1))}
                                    disabled={materialCurrentPage === materialTotalPages || materialPageSize === Infinity}
                                >
                                    Berikutnya
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Field Biaya Kirim Pembelian</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-3">
                        <div>
                            <div className="text-xs text-muted-foreground">No PO</div>
                            <Input value={fieldNoPo} readOnly />
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Date</div>
                            <Input value={fieldDate} readOnly />
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Ref PO In</div>
                            <Input value={fieldRefPoIn} readOnly />
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Customer</div>
                            <Input value={fieldCustomer} readOnly />
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Kode Vendor</div>
                            <Input value={fieldKdVdr} readOnly />
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Nama Vendor</div>
                            <Input value={fieldNmVdr} readOnly />
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Kode Material</div>
                            <Input value={fieldKdMat} readOnly />
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Material</div>
                            <Input value={fieldMat} readOnly />
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Qty</div>
                            <Input value={fieldQty} onChange={(e) => setFieldQty(e.target.value)} />
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Satuan</div>
                            <Input value={fieldUnit} readOnly />
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Price</div>
                            <Input value={fieldPrice} readOnly />
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Total Price</div>
                            <Input value={fieldTotalPrice} readOnly />
                        </div>
                        <div className="md:col-span-3">
                            <Button variant="default" onClick={handleAddBkpRow}>
                                Tambah Data
                            </Button>
                        </div>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader>
                        <CardTitle>Data Biaya Kirim Pembelian</CardTitle>
                    </CardHeader>
                    <CardContent className="w-full overflow-x-auto">
                        <Table className="min-w-[900px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[60px]">No</TableHead>
                                    <TableHead>No PO</TableHead>
                                    <TableHead>Kode Material</TableHead>
                                    <TableHead>Material</TableHead>
                                    <TableHead>Qty</TableHead>
                                    <TableHead>Satuan</TableHead>
                                    <TableHead>Price</TableHead>
                                    <TableHead>Total Price</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {bkpRows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                                            Belum ada data.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    bkpRows.map((row, idx) => (
                                        <TableRow key={`${row.no_po}-${row.kd_mat}-${idx}`}>
                                            <TableCell>{idx + 1}</TableCell>
                                            <TableCell>{renderValue(row.no_po)}</TableCell>
                                            <TableCell>{renderValue(row.kd_mat)}</TableCell>
                                            <TableCell>{renderValue(row.material)}</TableCell>
                                            <TableCell>{renderValue(row.qty)}</TableCell>
                                            <TableCell>{renderValue(row.unit)}</TableCell>
                                            <TableCell>{formatRupiah(row.price)} ({renderValue(row.price)})</TableCell>
                                            <TableCell>{formatRupiah(row.total_price)} ({renderValue(row.total_price)})</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={poModalOpen} onOpenChange={setPoModalOpen}>
                <DialogContent className="fixed inset-0 !left-0 !top-0 z-[210] !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 !rounded-none !p-0 !flex !flex-col overflow-hidden">
                    <div className="flex h-full w-full flex-col bg-background">
                        <div className="border-b px-4 py-3">
                            <DialogTitle>Cari PO</DialogTitle>
                        </div>
                        <div className="border-b px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Input
                                    placeholder="Cari No PO, Ref PO In, Customer..."
                                    value={poSearch}
                                    onChange={(e) => setPoSearch(e.target.value)}
                                    className="w-full sm:w-64"
                                />
                                <Select
                                    value={poPageSize === Infinity ? 'all' : String(poPageSize)}
                                    onValueChange={(value) => {
                                        if (value === 'all') {
                                            setPoPageSize(Infinity);
                                        } else {
                                            const parsed = Number(value);
                                            setPoPageSize(Number.isNaN(parsed) ? 5 : parsed);
                                        }
                                        setPoCurrentPage(1);
                                    }}
                                >
                                    <SelectTrigger className="w-full sm:w-[160px]">
                                        <SelectValue placeholder="Tampil" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PAGE_SIZE_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 py-4">
                            <div className="w-full overflow-x-auto">
                                <Table className="min-w-[900px]">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>No PO</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Ref PO In</TableHead>
                                            <TableHead>Customer</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {poLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                                                    Memuat data...
                                                </TableCell>
                                            </TableRow>
                                        ) : displayedPoRows.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                                                    Tidak ada data.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            displayedPoRows.map((row) => (
                                                <TableRow
                                                    key={`${row.no_po}-${row.ref_poin}`}
                                                    className="cursor-pointer"
                                                    onClick={() => {
                                                        handleSelectPo(row);
                                                        setPoModalOpen(false);
                                                    }}
                                                >
                                                    <TableCell>{renderValue(row.no_po)}</TableCell>
                                                    <TableCell>{formatDate(row.tgl)}</TableCell>
                                                    <TableCell>{renderValue(row.ref_poin)}</TableCell>
                                                    <TableCell>{renderValue(row.for_cus)}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                        <div className="border-t px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                                <div className="text-muted-foreground">Total data: {poRows.length}</div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPoCurrentPage((prev) => Math.max(1, prev - 1))}
                                        disabled={poCurrentPage === 1 || poPageSize === Infinity}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span>
                                        Halaman {poCurrentPage} / {poTotalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPoCurrentPage((prev) => Math.min(poTotalPages, prev + 1))}
                                        disabled={poCurrentPage === poTotalPages || poPageSize === Infinity}
                                    >
                                        Berikutnya
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
