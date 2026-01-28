import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trash2 } from 'lucide-react';
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
const formatRaw = (value) =>
    value === null || value === undefined || value === '' ? '-' : String(value);
    const formatRawPlain = (value) => {
        if (value === null || value === undefined || value === '') return '-';
        return String(value);
    };
const toNumber = (value) => {
    const num = Number(value);
    return Number.isNaN(num) ? 0 : num;
};
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
    const today = new Date().toISOString().slice(0, 10);
    const [currentStep, setCurrentStep] = useState(1);
    const [poModalOpen, setPoModalOpen] = useState(false);
    const [poRows, setPoRows] = useState([]);
    const [poTotal, setPoTotal] = useState(0);
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
    const [doAddRows, setDoAddRows] = useState([]);
    const [doAddSearch, setDoAddSearch] = useState('');
    const [doAddPageSize, setDoAddPageSize] = useState(5);
    const [doAddCurrentPage, setDoAddCurrentPage] = useState(1);
    const [dotNo, setDotNo] = useState('');

    const [fieldNoPo, setFieldNoPo] = useState('');
    const [fieldDate, setFieldDate] = useState('');
    const [fieldRefPoIn, setFieldRefPoIn] = useState('');
    const [fieldCustomer, setFieldCustomer] = useState('');
    const [fieldKdVdr, setFieldKdVdr] = useState('');
    const [fieldNmVdr, setFieldNmVdr] = useState('');
    const [fieldFranco, setFieldFranco] = useState('');
    const [fieldKdMat, setFieldKdMat] = useState('');
    const [fieldMat, setFieldMat] = useState('');
    const [fieldQty, setFieldQty] = useState('');
    const [fieldUnit, setFieldUnit] = useState('');
    const [fieldPrice, setFieldPrice] = useState('');
    const [fieldTotalPrice, setFieldTotalPrice] = useState('');
    const [fieldPriceSell, setFieldPriceSell] = useState('');
    const [fieldTotalPriceSell, setFieldTotalPriceSell] = useState('');
    const [fieldMargin, setFieldMargin] = useState('');
    const [fieldAddNoDo, setFieldAddNoDo] = useState('');
    const [fieldAddDate, setFieldAddDate] = useState('');
    const [fieldAddRefDo, setFieldAddRefDo] = useState('');
    const [fieldAddCustomer, setFieldAddCustomer] = useState('');
    const [fieldAddKdMat, setFieldAddKdMat] = useState('');
    const [fieldAddMat, setFieldAddMat] = useState('');
    const [fieldAddQty, setFieldAddQty] = useState('');
    const [fieldAddUnit, setFieldAddUnit] = useState('');
    const [fieldAddPrice, setFieldAddPrice] = useState('');
    const [fieldAddTotalPrice, setFieldAddTotalPrice] = useState('');
    const [fieldAddPriceSell, setFieldAddPriceSell] = useState('');
    const [fieldAddTotalPriceSell, setFieldAddTotalPriceSell] = useState('');
    const [fieldAddMargin, setFieldAddMargin] = useState('');

    const [bkpRows, setBkpRows] = useState([]);
    const [doAddRowsTable, setDoAddRowsTable] = useState([]);
    const [docDate, setDocDate] = useState(today);
    const [noInvoice, setNoInvoice] = useState('');
    const [namaEkspedisi, setNamaEkspedisi] = useState('');
    const [biayaKirim, setBiayaKirim] = useState('');

    const fetchPoRows = async () => {
        setPoLoading(true);
        try {
            const params = new URLSearchParams({
                search: poSearch,
                pageSize: poPageSize === Infinity ? 'all' : String(poPageSize),
                page: String(poCurrentPage),
            });
            const res = await fetch(`/penjualan/biaya-kirim-penjualan/do-list?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
            const data = await res.json();
            setPoRows(Array.isArray(data?.rows) ? data.rows : []);
            setPoTotal(typeof data?.total === 'number' ? data.total : (Array.isArray(data?.rows) ? data.rows.length : 0));
        } finally {
            setPoLoading(false);
        }
    };

    useEffect(() => {
        if (!poModalOpen) return;
        fetchPoRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [poModalOpen, poSearch, poPageSize, poCurrentPage]);

    const displayedPoRows = useMemo(() => {
        return poRows;
    }, [poRows]);

    const poTotalPages = useMemo(() => {
        if (poPageSize === Infinity) return 1;
        const size = poPageSize || 5;
        return Math.max(1, Math.ceil(poTotal / size));
    }, [poTotal, poPageSize]);

    const filteredMaterials = useMemo(() => {
        const term = materialSearch.trim().toLowerCase();
        if (!term) return materialRows;
        return materialRows.filter((row) =>
            String(row.material ?? row.mat ?? '').toLowerCase().includes(term)
        );
    }, [materialRows, materialSearch]);

    const filteredDoAddMaterials = useMemo(() => {
        const term = doAddSearch.trim().toLowerCase();
        if (!term) return doAddRows;
        return doAddRows.filter((row) =>
            String(row.mat ?? row.material ?? '').toLowerCase().includes(term)
        );
    }, [doAddRows, doAddSearch]);

    const materialTotalPages = useMemo(() => {
        if (materialPageSize === Infinity) return 1;
        const size = materialPageSize || 5;
        return Math.max(1, Math.ceil(filteredMaterials.length / size));
    }, [filteredMaterials.length, materialPageSize]);

    const doAddTotalPages = useMemo(() => {
        if (doAddPageSize === Infinity) return 1;
        const size = doAddPageSize || 5;
        return Math.max(1, Math.ceil(filteredDoAddMaterials.length / size));
    }, [filteredDoAddMaterials.length, doAddPageSize]);

    const displayedMaterials = useMemo(() => {
        if (materialPageSize === Infinity) return filteredMaterials;
        const size = materialPageSize || 5;
        const start = (materialCurrentPage - 1) * size;
        return filteredMaterials.slice(start, start + size);
    }, [filteredMaterials, materialPageSize, materialCurrentPage]);

    const displayedDoAddMaterials = useMemo(() => {
        if (doAddPageSize === Infinity) return filteredDoAddMaterials;
        const size = doAddPageSize || 5;
        const start = (doAddCurrentPage - 1) * size;
        return filteredDoAddMaterials.slice(start, start + size);
    }, [filteredDoAddMaterials, doAddPageSize, doAddCurrentPage]);

    const totalModal = useMemo(() => {
        const baseTotal = bkpRows.reduce((sum, row) => sum + toNumber(row.total_price), 0);
        const addTotal = doAddRowsTable.reduce((sum, row) => sum + toNumber(row.total_price), 0);
        return baseTotal + addTotal;
    }, [bkpRows, doAddRowsTable]);

    const totalDot = useMemo(() => {
        return doAddRowsTable.reduce((sum, row) => sum + toNumber(row.total_price), 0);
    }, [doAddRowsTable]);

    const totalSales = useMemo(() => {
        const baseTotal = bkpRows.reduce((sum, row) => sum + toNumber(row.total_price_sell), 0);
        const addTotal = doAddRowsTable.reduce((sum, row) => sum + toNumber(row.total_price_sell), 0);
        return baseTotal + addTotal;
    }, [bkpRows, doAddRowsTable]);

    const marginPercent = useMemo(() => {
        const cost = toNumber(biayaKirim);
        const profit = totalSales - totalModal - cost;
        if (totalModal === 0) return 0;
        return (profit / totalModal) * 100;
    }, [totalSales, totalModal, biayaKirim]);

    const handleSelectPo = async (row) => {
        if (!row?.no_do) return;
        const exists = selectedPos.some((item) => item.no_do === row.no_do);
        if (!exists) {
            setSelectedPos((prev) => [...prev, row]);
        }
        setSelectedPo(row);
        setFieldNoPo(row.no_do ?? '');
        setFieldDate(row.tgl ?? row.tgl_do ?? '');
        setFieldRefPoIn(row.ref_po ?? row.po_cust ?? '');
        setFieldCustomer(row.nm_cs ?? row.customer ?? '');
        setFieldKdVdr(row.kd_vdr ?? '');
        setFieldNmVdr(row.nm_vdr ?? '');
        setFieldFranco(row.franco_loco ?? '');

        const res = await fetch(`/penjualan/biaya-kirim-penjualan/do-materials?no_do=${encodeURIComponent(row.no_do)}`, {
            headers: { Accept: 'application/json' },
        });
        const data = await res.json();
        setMaterialRows(Array.isArray(data?.rows) ? data.rows : []);
        setMaterialSearch('');
        setMaterialPageSize(5);
        setMaterialCurrentPage(1);

        const dotRes = await fetch(`/penjualan/biaya-kirim-penjualan/dot-materials?no_do=${encodeURIComponent(row.no_do)}`, {
            headers: { Accept: 'application/json' },
        });
        const dotData = await dotRes.json();
        setDotNo(dotData?.rows?.[0]?.no_dob ?? '');
        setDoAddRows(Array.isArray(dotData?.rows) ? dotData.rows : []);
        setDoAddSearch('');
        setDoAddPageSize(5);
        setDoAddCurrentPage(1);
    };

    const handleSelectMaterial = async (row) => {
        setFieldKdMat(row.kd_mat ?? '');
        setFieldMat(row.material ?? row.mat ?? '');
        setFieldQty(row.qty ?? '');
        setFieldUnit(row.unit ?? '');
        setFieldPrice(row.harga ?? row.price ?? '');
        setFieldTotalPrice(row.total ?? row.total_price ?? '');
        setFieldPriceSell('');
        setFieldTotalPriceSell('');
        setFieldMargin('');

        const refPo = fieldRefPoIn || row.ref_po || row.po_cust;
        if (refPo) {
            const res = await fetch(
                `/pembelian/biaya-kirim-pembelian/pr-price?ref_po=${encodeURIComponent(refPo)}`,
                { headers: { Accept: 'application/json' } }
            );
            const data = await res.json();
            const sellPrice = toNumber(data?.price_po);
            const qty = toNumber(row.qty);
            const totalSell = sellPrice * qty;
            const totalBuy = toNumber(row.total_price);
            const margin = totalBuy === 0 ? 0 : ((totalSell - totalBuy) / totalBuy) * 100;
            setFieldPriceSell(data?.price_po ?? '');
            setFieldTotalPriceSell(totalSell);
            setFieldMargin(margin.toFixed(2));
        }
    };

    const handleSelectMaterialAdd = (row) => {
        const noDotValue = row?.no_dob ?? dotNo ?? '';
        setFieldAddNoDo(noDotValue);
        setFieldAddDate(fieldDate ?? '');
        setFieldAddRefDo(fieldNoPo ?? '');
        setFieldAddCustomer(fieldCustomer ?? '');
        setFieldAddKdMat(row.kd_mat ?? '');
        setFieldAddMat(row.mat ?? row.material ?? '');
        setFieldAddQty(row.qty ?? '');
        setFieldAddUnit(row.unit ?? '');
        setFieldAddPrice(row.harga ?? row.price ?? '');
        setFieldAddTotalPrice(row.total ?? row.total_price ?? '');
        setFieldAddPriceSell('');
        setFieldAddTotalPriceSell('');
        setFieldAddMargin('');
    };

    useEffect(() => {
        if (!fieldPriceSell) return;
        const qty = toNumber(fieldQty);
        const sellPrice = toNumber(fieldPriceSell);
        const totalSell = qty * sellPrice;
        setFieldTotalPriceSell(totalSell);
        const totalBuy = toNumber(fieldTotalPrice);
        const margin = totalBuy === 0 ? 0 : ((totalSell - totalBuy) / totalBuy) * 100;
        setFieldMargin(margin.toFixed(2));
    }, [fieldQty, fieldPriceSell, fieldTotalPrice]);

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
                date: fieldDate,
                ref_po_in: fieldRefPoIn,
                customer: fieldCustomer,
                vendor: fieldNmVdr,
                franco: fieldFranco,
                qty: fieldQty,
                unit: fieldUnit,
                price: fieldPrice,
                total_price: fieldTotalPrice,
                price_sell: fieldPriceSell,
                total_price_sell: fieldTotalPriceSell,
                margin: fieldMargin,
            },
        ]);
        setFieldKdMat('');
        setFieldMat('');
        setFieldQty('');
        setFieldUnit('');
        setFieldPrice('');
        setFieldTotalPrice('');
        setFieldPriceSell('');
        setFieldTotalPriceSell('');
        setFieldMargin('');
    };

    const handleAddDoAddRow = () => {
        if (!fieldAddNoDo) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'warning',
                title: 'Pilih material DO Add terlebih dahulu',
                showConfirmButton: false,
                timer: 2500,
                timerProgressBar: true,
            });
            return;
        }
        const exists = doAddRowsTable.some(
            (row) => String(row.no_dot) === String(fieldAddNoDo) && String(row.kd_mat) === String(fieldAddKdMat)
        );
        if (exists) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'warning',
                title: 'Data sudah ada (No DO Add & Kode Material)',
                showConfirmButton: false,
                timer: 2500,
                timerProgressBar: true,
            });
            return;
        }
        setDoAddRowsTable((prev) => [
            ...prev,
            {
                no_dot: fieldAddNoDo,
                no_do: fieldAddRefDo,
                kd_mat: fieldAddKdMat,
                material: fieldAddMat,
                date: fieldAddDate,
                customer: fieldAddCustomer,
                qty: fieldAddQty,
                unit: fieldAddUnit,
                price: fieldAddPrice,
                total_price: fieldAddTotalPrice,
                price_sell: fieldAddPriceSell,
                total_price_sell: fieldAddTotalPriceSell,
                margin: fieldAddMargin,
            },
        ]);
        setFieldAddKdMat('');
        setFieldAddMat('');
        setFieldAddQty('');
        setFieldAddUnit('');
        setFieldAddPrice('');
        setFieldAddTotalPrice('');
        setFieldAddPriceSell('');
        setFieldAddTotalPriceSell('');
        setFieldAddMargin('');
    };

    const handleRemoveBkpRow = (index) => {
        setBkpRows((prev) => prev.filter((_, idx) => idx !== index));
    };

    const handleRemoveDoAddRow = (index) => {
        setDoAddRowsTable((prev) => prev.filter((_, idx) => idx !== index));
    };

    const handleSave = () => {
        router.post(
            '/penjualan/biaya-kirim-penjualan',
            {
                doc_date: docDate,
                no_invoice: noInvoice,
                nama_ekspedisi: namaEkspedisi,
                biaya_kirim: biayaKirim,
                total_cost: totalModal,
                total_sales: totalSales,
                margin_percent: marginPercent,
                margin_final: marginPercent,
                total_dot: totalDot,
                rows: bkpRows,
                rows_add: doAddRowsTable,
            },
            {
                onError: () => {
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'error',
                        title: 'Gagal menyimpan data.',
                        showConfirmButton: false,
                        timer: 2500,
                        timerProgressBar: true,
                    });
                },
            }
        );
    };

    return (
        <AppLayout breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Biaya Kirim Penjualan', href: '/penjualan/biaya-kirim-penjualan' }, { title: 'Create', href: '/penjualan/biaya-kirim-penjualan/create' }]}>
            <Head title="Create Biaya Kirim Penjualan" />
            <div className="flex flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Button
                        variant={currentStep === 1 ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrentStep(1)}
                    >
                        DATA DO
                    </Button>
                    <Button
                        variant={currentStep === 2 ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrentStep(2)}
                    >
                        DATA EKSPEDISI
                    </Button>
                </div>

                {currentStep === 1 && (
                    <>
                        <div className="flex flex-wrap items-center gap-3">
                            <Button variant="default" onClick={() => setPoModalOpen(true)}>
                                Cari DO
                            </Button>
                        </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Data DO</CardTitle>
                    </CardHeader>
                    <CardContent className="w-full overflow-x-auto">
                        <Table className="min-w-[900px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[60px]">No</TableHead>
                                    <TableHead>No DO</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Ref PO In</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead className="text-center">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedPos.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                                            Belum ada data DO.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    selectedPos.map((row, idx) => (
                                        <TableRow
                                            key={`${row.no_do}-${idx}`}
                                            className={`cursor-pointer ${selectedPo?.no_do === row.no_do ? 'bg-muted/30' : ''}`}
                                            onClick={() => handleSelectPo(row)}
                                        >
                                            <TableCell>{idx + 1}</TableCell>
                                            <TableCell>{renderValue(row.no_do)}</TableCell>
                                            <TableCell>{formatDate(row.tgl)}</TableCell>
                                            <TableCell>{renderValue(row.po_cust)}</TableCell>
                                            <TableCell>{renderValue(row.customer)}</TableCell>
                                            <TableCell className="text-center">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setSelectedPos((prev) =>
                                                            prev.filter((item) => item.no_do !== row.no_do)
                                                        );
                                                        if (selectedPo?.no_do === row.no_do) {
                                                            setSelectedPo(null);
                                                            setFieldNoPo('');
                                                            setFieldDate('');
                                                            setFieldRefPoIn('');
                                                            setFieldCustomer('');
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>


                <Card>
                    <CardHeader>
                        <CardTitle>Material In DO</CardTitle>
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
                                            <TableCell>{renderValue(row.material ?? row.mat)}</TableCell>
                                            <TableCell>{renderValue(row.qty)}</TableCell>
                                            <TableCell>{renderValue(row.unit)}</TableCell>
                                    <TableCell>{formatRupiah(row.harga)} ({formatRaw(row.harga)})</TableCell>
                                    <TableCell>{formatRupiah(row.total)} ({formatRaw(row.total)})</TableCell>
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
                        <CardTitle>Material In DO Add</CardTitle>
                    </CardHeader>
                    <CardContent className="w-full overflow-x-auto">
                        <div className="flex flex-wrap items-end gap-3 pb-3">
                            <div className="w-full sm:w-64">
                                <div className="text-xs text-muted-foreground">No DO Add</div>
                                <Input value={dotNo} readOnly />
                            </div>
                            <div className="w-full sm:flex-1">
                                <Input
                                    placeholder="Cari material..."
                                    value={doAddSearch}
                                    onChange={(e) => setDoAddSearch(e.target.value)}
                                    className="w-full"
                                />
                            </div>
                            <Select
                                value={doAddPageSize === Infinity ? 'all' : String(doAddPageSize)}
                                onValueChange={(value) => {
                                    if (value === 'all') {
                                        setDoAddPageSize(Infinity);
                                    } else {
                                        const parsed = Number(value);
                                        setDoAddPageSize(Number.isNaN(parsed) ? 5 : parsed);
                                    }
                                    setDoAddCurrentPage(1);
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
                                {displayedDoAddMaterials.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                                            Tidak ada data.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    displayedDoAddMaterials.map((row, idx) => (
                                        <TableRow
                                            key={`${row.no_dob}-${row.mat}-${idx}`}
                                            className="cursor-pointer"
                                            onClick={() => handleSelectMaterialAdd(row)}
                                        >
                                            <TableCell>{idx + 1 + (doAddPageSize === Infinity ? 0 : (doAddCurrentPage - 1) * doAddPageSize)}</TableCell>
                                            <TableCell>{renderValue(row.kd_mat)}</TableCell>
                                            <TableCell>{renderValue(row.mat)}</TableCell>
                                            <TableCell>{renderValue(row.qty)}</TableCell>
                                            <TableCell>{renderValue(row.unit)}</TableCell>
                                            <TableCell>{formatRupiah(row.harga)} ({formatRaw(row.harga)})</TableCell>
                                            <TableCell>{formatRupiah(row.total)} ({formatRaw(row.total)})</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 text-sm">
                            <div className="text-muted-foreground">Total data: {filteredDoAddMaterials.length}</div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setDoAddCurrentPage((prev) => Math.max(1, prev - 1))}
                                    disabled={doAddCurrentPage === 1 || doAddPageSize === Infinity}
                                >
                                    Sebelumnya
                                </Button>
                                <span>
                                    Halaman {doAddCurrentPage} / {doAddTotalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setDoAddCurrentPage((prev) => Math.min(doAddTotalPages, prev + 1))}
                                    disabled={doAddCurrentPage === doAddTotalPages || doAddPageSize === Infinity}
                                >
                                    Berikutnya
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Field DO</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-3">
                        <div>
                            <div className="text-xs text-muted-foreground">No DO</div>
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
                                <div>
                                    <div className="text-xs text-muted-foreground">Sell Price</div>
                                    <Input value={fieldPriceSell} readOnly />
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Total Sell Price</div>
                                    <Input value={fieldTotalPriceSell} readOnly />
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Margin</div>
                                    <Input value={fieldMargin ? `${fieldMargin}%` : ''} readOnly />
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
                        <CardTitle>Field DO Add</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-3">
                        <div>
                            <div className="text-xs text-muted-foreground">No DO Add</div>
                            <Input value={fieldAddNoDo} readOnly />
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Date</div>
                            <Input value={fieldAddNoDo ? fieldAddDate : ''} readOnly />
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Ref DO</div>
                            <Input value={fieldAddNoDo ? fieldAddRefDo : ''} readOnly />
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Customer</div>
                            <Input value={fieldAddNoDo ? fieldAddCustomer : ''} readOnly />
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Kode Material</div>
                            <Input value={fieldAddKdMat} readOnly />
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Material</div>
                            <Input value={fieldAddMat} readOnly />
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Qty</div>
                            <Input value={fieldAddQty} onChange={(e) => setFieldAddQty(e.target.value)} />
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Satuan</div>
                            <Input value={fieldAddUnit} readOnly />
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Price</div>
                            <Input value={fieldAddPrice} readOnly />
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Total Price</div>
                            <Input value={fieldAddTotalPrice} readOnly />
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Sell Price</div>
                            <Input value={fieldAddPriceSell} readOnly />
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Total Sell Price</div>
                            <Input value={fieldAddTotalPriceSell} readOnly />
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Margin</div>
                            <Input value={fieldAddMargin ? `${fieldAddMargin}%` : ''} readOnly />
                        </div>
                        <div className="md:col-span-3">
                            <Button variant="default" onClick={handleAddDoAddRow}>
                                Tambah Data
                            </Button>
                        </div>
                    </CardContent>
                </Card>
                        <div className="flex justify-end">
                            <Button variant="default" onClick={() => setCurrentStep(2)}>
                                Lanjut
                            </Button>
                        </div>
                    </>
                )}

                {currentStep === 2 && (
                    <>
                        <Card>
                            <CardHeader>
                                <CardTitle>Data Ekspedisi / Vendor</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-3">
                                <div>
                                    <div className="text-xs text-muted-foreground">Doc. Date</div>
                                    <Input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">No Invoice</div>
                                    <Input value={noInvoice} onChange={(e) => setNoInvoice(e.target.value)} />
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Nama Ekspedisi</div>
                                    <Input value={namaEkspedisi} onChange={(e) => setNamaEkspedisi(e.target.value)} />
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Biaya Kirim</div>
                                    <Input value={biayaKirim} onChange={(e) => setBiayaKirim(e.target.value)} />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Cost & Margin Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-4">
                                <div>
                                    <div className="text-xs text-muted-foreground">Total Cost</div>
                                    <div className="text-lg font-semibold">
                                        {formatRupiah(totalModal)} ({formatRawPlain(totalModal)})
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Total Sales</div>
                                    <div className="text-lg font-semibold">{formatRupiah(totalSales)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Shipping Sales</div>
                                    <div className="text-lg font-semibold">{marginPercent.toFixed(2)}%</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Final Margin</div>
                                    <div className="text-lg font-semibold">{marginPercent.toFixed(2)}%</div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Data Biaya Kirim Penjualan DO</CardTitle>
                            </CardHeader>
                            <CardContent className="w-full overflow-x-auto">
                                <Table className="min-w-[900px]">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[60px]">No</TableHead>
                                            <TableHead>No DO</TableHead>
                                            <TableHead>Kode Material</TableHead>
                                            <TableHead>Material</TableHead>
                                            <TableHead>Qty</TableHead>
                                            <TableHead>Satuan</TableHead>
                                            <TableHead>Price</TableHead>
                                            <TableHead>Total Price</TableHead>
                                            <TableHead>Sell Price</TableHead>
                                            <TableHead>Total Sell Price</TableHead>
                                            <TableHead>Margin</TableHead>
                                            <TableHead className="w-[90px] text-center">Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {bkpRows.length === 0 ? (
                                            <TableRow>
                                        <TableCell colSpan={12} className="text-center text-sm text-muted-foreground">
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
                                            <TableCell>{formatRupiah(row.price)} ({formatRaw(row.price)})</TableCell>
                                            <TableCell>{formatRupiah(row.total_price)} ({formatRaw(row.total_price)})</TableCell>
                                            <TableCell>{formatRupiah(row.price_sell)} ({formatRaw(row.price_sell)})</TableCell>
                                            <TableCell>{formatRupiah(row.total_price_sell)} ({formatRaw(row.total_price_sell)})</TableCell>
                                            <TableCell>{renderValue(row.margin)}%</TableCell>
                                            <TableCell className="text-center">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleRemoveBkpRow(idx)}
                                                    className="text-destructive hover:text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Data Biaya Kirim Penjualan DO Add</CardTitle>
                            </CardHeader>
                            <CardContent className="w-full overflow-x-auto">
                                <Table className="min-w-[900px]">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[60px]">No</TableHead>
                                            <TableHead>No DOT</TableHead>
                                            <TableHead>No DO</TableHead>
                                            <TableHead>Kode Material</TableHead>
                                            <TableHead>Material</TableHead>
                                            <TableHead>Qty</TableHead>
                                            <TableHead>Satuan</TableHead>
                                            <TableHead>Price</TableHead>
                                            <TableHead>Total Price</TableHead>
                                            <TableHead>Sell Price</TableHead>
                                            <TableHead>Total Sell Price</TableHead>
                                            <TableHead>Margin</TableHead>
                                            <TableHead className="w-[90px] text-center">Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {doAddRowsTable.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={13} className="text-center text-sm text-muted-foreground">
                                                    Belum ada data.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            doAddRowsTable.map((row, idx) => (
                                                <TableRow key={`${row.no_dot || row.no_do}-${row.kd_mat || idx}-add-${idx}`}>
                                                    <TableCell>{idx + 1}</TableCell>
                                                    <TableCell>{renderValue(row.no_dot)}</TableCell>
                                                    <TableCell>{renderValue(row.no_do)}</TableCell>
                                                    <TableCell>{renderValue(row.kd_mat)}</TableCell>
                                                    <TableCell>{renderValue(row.material)}</TableCell>
                                                    <TableCell>{renderValue(row.qty)}</TableCell>
                                                    <TableCell>{renderValue(row.unit)}</TableCell>
                                                    <TableCell>{formatRupiah(row.price)} ({formatRaw(row.price)})</TableCell>
                                                    <TableCell>{formatRupiah(row.total_price)} ({formatRaw(row.total_price)})</TableCell>
                                                    <TableCell>{formatRupiah(row.price_sell)} ({formatRaw(row.price_sell)})</TableCell>
                                                    <TableCell>{formatRupiah(row.total_price_sell)} ({formatRaw(row.total_price_sell)})</TableCell>
                                                    <TableCell>{renderValue(row.margin)}%</TableCell>
                                                    <TableCell className="text-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleRemoveDoAddRow(idx)}
                                                            className="text-destructive hover:text-destructive"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <Button variant="outline" onClick={() => setCurrentStep(1)}>
                                Kembali
                            </Button>
                            <Button variant="default" onClick={handleSave}>Simpan Data</Button>
                        </div>
                    </>
                )}
            </div>

            <Dialog open={poModalOpen} onOpenChange={setPoModalOpen}>
                <DialogContent className="fixed inset-0 !left-0 !top-0 z-[210] !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 !rounded-none !p-0 !flex !flex-col overflow-hidden">
                    <div className="flex h-full w-full flex-col bg-background">
                        <div className="border-b px-4 py-3">
                            <DialogTitle>Cari DO</DialogTitle>
                        </div>
                        <div className="border-b px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Input
                                    placeholder="Cari No DO, Ref PO In, Customer..."
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
                                            <TableHead>No DO</TableHead>
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
                                                    key={`${row.no_do}-${row.ref_po}`}
                                                    className="cursor-pointer"
                                                    onClick={() => {
                                                        handleSelectPo(row);
                                                        setPoModalOpen(false);
                                                    }}
                                                >
                                                    <TableCell>{renderValue(row.no_do)}</TableCell>
                                                    <TableCell>{formatDate(row.tgl)}</TableCell>
                                                    <TableCell>{renderValue(row.po_cust)}</TableCell>
                                                    <TableCell>{renderValue(row.customer)}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                        <div className="border-t px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                                <div className="text-muted-foreground">Total data: {poTotal}</div>
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
