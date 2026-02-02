import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

export default function BiayaKirimPembelianEdit({ header = {}, details = [] }) {
    const today = new Date().toISOString().slice(0, 10);
    const [currentStep, setCurrentStep] = useState(1);

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

    const [bkpRows, setBkpRows] = useState([]);
    const [docDate, setDocDate] = useState(today);
    const [noInvoice, setNoInvoice] = useState('');
    const [namaEkspedisi, setNamaEkspedisi] = useState('');
    const [biayaKirim, setBiayaKirim] = useState('');
    const [fieldNoBkp, setFieldNoBkp] = useState('');

    useEffect(() => {
        const headerDate = header?.tgl_inv ? String(header.tgl_inv).slice(0, 10) : today;
        setDocDate(headerDate);
        setNoInvoice(header?.no_inv ?? '');
        setNamaEkspedisi(header?.Vendor_Ekspedisi ?? '');
        setBiayaKirim(header?.biaya_kirim ?? '');
        setFieldNoBkp(header?.no_bkp ?? '');

        const mappedDetails = Array.isArray(details) ? details.map((row) => ({
            no_po: row.no_po ?? '',
            kd_mat: row.kd_mat ?? '',
            material: row.material ?? '',
            date: row.tgl_po ?? '',
            ref_po_in: row.po_cust ?? '',
            customer: row.customer ?? '',
            vendor: row.vendor ?? '',
            franco: row.franco ?? '',
            qty: row.qty ?? 0,
            unit: row.unit ?? '',
            price: row.harga_modal ?? 0,
            total_price: row.total_modal ?? 0,
            price_sell: row.harga_jual ?? 0,
            total_price_sell: row.total_jual ?? 0,
            margin: row.margin ?? '',
        })) : [];
        setBkpRows(mappedDetails);

        const uniquePos = [];
        const seen = new Set();
        mappedDetails.forEach((row) => {
            if (!row.no_po) return;
            if (seen.has(row.no_po)) return;
            seen.add(row.no_po);
            uniquePos.push({
                no_po: row.no_po,
                tgl: row.date,
                ref_poin: row.ref_po_in,
                for_cus: row.customer,
                kd_vdr: row.po_kd_vdr ?? row.kd_vdr ?? '',
                nm_vdr: row.vendor,
                franco_loco: row.franco,
            });
        });
        setSelectedPos(uniquePos);
        setSelectedPo(uniquePos[0] ?? null);
        if (uniquePos[0]) {
            setFieldNoPo(uniquePos[0].no_po ?? '');
            setFieldDate(uniquePos[0].tgl ?? '');
            setFieldRefPoIn(uniquePos[0].ref_poin ?? '');
            setFieldCustomer(uniquePos[0].for_cus ?? '');
            setFieldNmVdr(uniquePos[0].nm_vdr ?? '');
            setFieldFranco(uniquePos[0].franco_loco ?? '');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [header, details]);

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

    const totalModal = useMemo(() => {
        return bkpRows.reduce((sum, row) => sum + toNumber(row.total_price), 0);
    }, [bkpRows]);

    const totalSales = useMemo(() => {
        return bkpRows.reduce((sum, row) => sum + toNumber(row.total_price_sell), 0);
    }, [bkpRows]);

    const marginPercent = useMemo(() => {
        const cost = toNumber(biayaKirim);
        const profit = totalSales - totalModal - cost;
        if (totalModal === 0) return 0;
        return (profit / totalModal) * 100;
    }, [totalSales, totalModal, biayaKirim]);

    const handleSelectPo = async (row) => {
        if (!row?.no_po) return;
        setSelectedPo(row);
        setFieldNoPo(row.no_po ?? '');
        setFieldDate(row.tgl ?? '');
        setFieldRefPoIn(row.ref_poin ?? '');
        setFieldCustomer(row.for_cus ?? '');
        setFieldNmVdr(row.nm_vdr ?? '');
        setFieldFranco(row.franco_loco ?? '');

        const res = await fetch(`/pembelian/biaya-kirim-pembelian/po-materials?no_po=${encodeURIComponent(row.no_po)}`, {
            headers: { Accept: 'application/json' },
        });
        const data = await res.json();
        setMaterialRows(Array.isArray(data?.rows) ? data.rows : []);
        setMaterialSearch('');
        setMaterialPageSize(5);
        setMaterialCurrentPage(1);
    };

    const handleSelectMaterial = async (row) => {
        setFieldKdMat(row.kd_mat ?? '');
        setFieldMat(row.material ?? '');
        setFieldQty(row.qty ?? '');
        setFieldUnit(row.unit ?? '');
        setFieldPrice(row.price ?? '');
        setFieldTotalPrice(row.total_price ?? '');
        setFieldPriceSell('');
        setFieldTotalPriceSell('');
        setFieldMargin('');

        const refPo = fieldRefPoIn || row.ref_poin;
        if (refPo && row.kd_mat) {
            const res = await fetch(
                `/pembelian/biaya-kirim-pembelian/pr-price?ref_po=${encodeURIComponent(refPo)}&kd_material=${encodeURIComponent(row.kd_mat)}`,
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

    const handleSave = () => {
        if (!fieldNoBkp) return;
        router.post(
            `/pembelian/biaya-kirim-pembelian/${encodeURIComponent(fieldNoBkp)}`,
            {
                doc_date: docDate,
                no_invoice: noInvoice,
                nama_ekspedisi: namaEkspedisi,
                biaya_kirim: biayaKirim,
                total_cost: totalModal,
                total_sales: totalSales,
                margin_percent: marginPercent,
                rows: bkpRows,
            }
        );
    };

    return (
        <AppLayout breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Biaya Kirim Pembelian', href: '/pembelian/biaya-kirim-pembelian' }, { title: 'Edit', href: `/pembelian/biaya-kirim-pembelian/${fieldNoBkp}/edit` }]}>
            <Head title="Edit Biaya Kirim Pembelian" />
            <div className="flex flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Button
                        variant={currentStep === 1 ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrentStep(1)}
                    >
                        DATA PO
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
                                    <TableHead>Franco</TableHead>
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
                                            <TableCell>{renderValue(row.franco_loco)}</TableCell>
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
                                    <TableCell>{formatRupiah(row.price)} ({formatRaw(row.price)})</TableCell>
                                    <TableCell>{formatRupiah(row.total_price)} ({formatRaw(row.total_price)})</TableCell>
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
                                    <div className="text-xs text-muted-foreground">No Biaya Kirim Pembelian</div>
                                    <Input value={fieldNoBkp} readOnly />
                                </div>
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
                            <CardContent className="grid gap-4 md:grid-cols-3">
                                <div>
                                    <div className="text-xs text-muted-foreground">Total Cost</div>
                                    <div className="text-lg font-semibold">
                                        {formatRupiah(totalModal)} ({formatRaw(totalModal)})
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Total Sales</div>
                                    <div className="text-lg font-semibold">{formatRupiah(totalSales)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Margin</div>
                                    <div className="text-lg font-semibold">{marginPercent.toFixed(2)}%</div>
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
                                            <TableHead>Sell Price</TableHead>
                                            <TableHead>Total Sell Price</TableHead>
                                            <TableHead>Margin</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {bkpRows.length === 0 ? (
                                            <TableRow>
                                        <TableCell colSpan={11} className="text-center text-sm text-muted-foreground">
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

        </AppLayout>
    );
}
