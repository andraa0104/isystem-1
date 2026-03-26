import { useMemo, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PAGE_OPTIONS = [
    { value: '5', label: '5' },
    { value: '10', label: '10' },
    { value: '25', label: '25' },
    { value: '50', label: '50' },
    { value: 'all', label: 'Semua data' },
];

const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(value ?? 0));
const formatMoney = (value) => {
    if (value === null || value === undefined || value === '') return '0';
    const num = Number(value);
    if (Number.isNaN(num)) return String(value);
    const hasFraction = !Number.isInteger(num);
    return new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: hasFraction ? 2 : 0,
        maximumFractionDigits: 3,
    }).format(num);
};
const formatDbMoney = (value) => {
    if (value === null || value === undefined || value === '') return '0';
    const str = String(value);
    const [, fraction = ''] = str.split(/[.,]/);
    const minFrac = fraction.length;
    const num = Number(str.replace(',', '.'));
    if (Number.isNaN(num)) return str;
    return new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: minFrac,
        maximumFractionDigits: Math.max(minFrac, 3),
    }).format(num);
};
const parsePercent = (raw) => {
    if (raw === null || raw === undefined || raw === '') return 0;
    const cleaned = String(raw).replace(/[^0-9.,-]/g, '').replace(',', '.').trim();
    const num = Number(cleaned);
    return Number.isNaN(num) ? 0 : num;
};

export default function InvoiceMasukEdit({ invoice, invoiceItems = [], noGudang }) {
    const [step, setStep] = useState(1);
    const [header, setHeader] = useState({
        no_fi: invoice?.no_doc ?? '',
        no_gudang: noGudang ?? '',
        ref_po: invoice?.ref_po ?? '',
        vendor: invoice?.nm_vdr ?? '',
        kd_vdr: invoice?.kd_vdr ?? '',
        payment_terms: invoice?.p_term ?? '',
        ppn: invoice?.ppn ?? 0,
        date_receipt: invoice?.inv_d ?? '',
        date_doc: invoice?.doc_rec ?? '',
        no_receipt: invoice?.t_doc ?? '',
    });

    const [materials, setMaterials] = useState(
        Array.isArray(invoiceItems)
            ? invoiceItems.map((item) => ({
                kd_mat: item.kd_mat ?? '',
                material: item.mat ?? '',
                qty: item.qty_gr ?? 0,
                unit: item.unit ?? '',
                price: item.harga ?? 0,
                total_price: item.ttl_harga ?? 0,
            }))
            : []
    );

    const [materialPageSize, setMaterialPageSize] = useState(5);
    const [materialPage, setMaterialPage] = useState(1);

    const materialTotalPages = useMemo(() => {
        if (materialPageSize === Infinity) return 1;
        return Math.max(1, Math.ceil(materials.length / materialPageSize));
    }, [materials.length, materialPageSize]);

    const displayedMaterials = useMemo(() => {
        if (materialPageSize === Infinity) return materials;
        const start = (materialPage - 1) * materialPageSize;
        return materials.slice(start, start + materialPageSize);
    }, [materials, materialPage, materialPageSize]);

    const subTotal = useMemo(
        () =>
            materials.reduce(
                (sum, item) =>
                    sum + Number(item.price ?? 0) * Number(item.qty ?? 0),
                0
            ),
        [materials]
    );
    const pricePpn = useMemo(() => {
        const p = parsePercent(header.ppn);
        const factor = p > 1 ? p / 100 : p;
        return subTotal * factor;
    }, [subTotal, header.ppn]);
    const grandTotal = useMemo(() => subTotal + pricePpn, [subTotal, pricePpn]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await router.post(`/pembelian/invoice-masuk/${invoice?.no_doc}`, {
                no_receipt: header.no_receipt,
                ref_po: header.ref_po,
                doc_rec: header.date_doc,
                inv_d: header.date_receipt,
                p_term: header.payment_terms,
                nm_vdr: header.vendor,
                kd_vdr: header.kd_vdr,
                ppn: header.ppn,
                a_idr: subTotal,
                tax: pricePpn,
                total: grandTotal,
                no_gudang: header.no_gudang,
                items: materials.map((item) => ({
                    kd_mat: item.kd_mat,
                    material: item.material,
                    qty: item.qty,
                    unit: item.unit,
                    price: item.price,
                    total_price: item.total_price ?? item.price,
                })),
            }, {
                preserveScroll: true,
            });
        } catch (err) {
            // handled by flash
        }
    };

    return (
        <AppLayout breadcrumbs={[
            { title: 'Dashboard', href: '/dashboard' },
            { title: 'Invoice Masuk', href: '/pembelian/invoice-masuk' },
            { title: 'Edit FI', href: `/pembelian/invoice-masuk/${invoice?.no_doc}/edit` },
        ]}>
            <Head title="Edit Invoice Masuk" />
            <div className="p-4 space-y-4">
                {step === 1 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Step 1 - Data Header</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>No FI</Label>
                                    <Input value={header.no_fi} disabled />
                                </div>
                                <div className="space-y-2">
                                    <Label>No Gudang</Label>
                                    <Input value={header.no_gudang} disabled />
                                </div>
                                <div className="space-y-2">
                                    <Label>Ref PO</Label>
                                    <Input value={header.ref_po} disabled />
                                </div>
                                <div className="space-y-2">
                                    <Label>Vendor</Label>
                                    <Input value={header.vendor} disabled />
                                </div>
                                <div className="space-y-2">
                                    <Label>Kode Vendor</Label>
                                    <Input value={header.kd_vdr} disabled />
                                </div>
                                <div className="space-y-2">
                                    <Label>Payment Terms</Label>
                                    <Input value={header.payment_terms} disabled />
                                </div>
                                <div className="space-y-2">
                                    <Label>PPN</Label>
                                    <Input value={header.ppn} disabled />
                                </div>
                                <div className="space-y-2">
                                    <Label>Date Receipt</Label>
                                    <Input type="date" value={header.date_receipt} onChange={(e) => setHeader({ ...header, date_receipt: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Date</Label>
                                    <Input type="date" value={header.date_doc} onChange={(e) => setHeader({ ...header, date_doc: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>No Receipt (FI)</Label>
                                    <Input value={header.no_receipt} onChange={(e) => setHeader({ ...header, no_receipt: e.target.value })} />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Button
                                    variant="default"
                                    onClick={() => setStep(2)}
                                    disabled={!header.no_gudang || !header.ref_po || !header.no_receipt}
                                >
                                    Lanjut
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {step === 2 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Step 2 - Material in PO</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-wrap gap-3">
                                <Select value={String(materialPageSize === Infinity ? 'all' : materialPageSize)} onValueChange={(val) => {
                                    setMaterialPage(1);
                                    setMaterialPageSize(val === 'all' ? Infinity : Number(val));
                                }}>
                                    <SelectTrigger className="w-32">
                                        <SelectValue placeholder="Tampilkan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PAGE_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>No</TableHead>
                                            <TableHead>Kode Material</TableHead>
                                            <TableHead>Material</TableHead>
                                            <TableHead>Qty</TableHead>
                                            <TableHead>Satuan</TableHead>
                                            <TableHead className="text-right">Price</TableHead>
                                            <TableHead className="text-right">Total Price</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {displayedMaterials.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center text-muted-foreground">
                                                    Tidak ada data material.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {displayedMaterials.map((row, idx) => (
                                            <TableRow key={`${row.kd_mat}-${idx}`}>
                                                <TableCell>{(materialPage - 1) * (materialPageSize === Infinity ? displayedMaterials.length : materialPageSize) + idx + 1}</TableCell>
                                                <TableCell>{row.kd_mat}</TableCell>
                                                <TableCell>{row.material}</TableCell>
                                                <TableCell>{row.qty}</TableCell>
                                                <TableCell>{row.unit}</TableCell>
                                                <TableCell className="text-right">Rp {formatDbMoney(row.price)}</TableCell>
                                                <TableCell className="text-right">Rp {formatNumber(row.total_price ?? row.price)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            {materialPageSize !== Infinity && materials.length > 0 && (
                                <div className="flex items-center justify-between text-sm text-muted-foreground">
                                    <div>
                                        Menampilkan {(materialPage - 1) * materialPageSize + 1} - {Math.min(materialPage * materialPageSize, materials.length)} dari {materials.length} data
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setMaterialPage((p) => Math.max(1, p - 1))}
                                            disabled={materialPage === 1}
                                        >
                                            Sebelumnya
                                        </Button>
                                        <span>Halaman {materialPage} / {materialTotalPages}</span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setMaterialPage((p) => Math.min(materialTotalPages, p + 1))}
                                            disabled={materialPage === materialTotalPages}
                                        >
                                            Berikutnya
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Label>Sub total</Label>
                                    <Input value={`Rp ${formatDbMoney(subTotal)}`} disabled />
                                </div>
                                <div className="space-y-2">
                                    <Label>Price PPN</Label>
                                    <Input value={`Rp ${formatMoney(pricePpn)}`} disabled />
                                </div>
                                <div className="space-y-2">
                                    <Label>Grand Total</Label>
                                    <Input value={`Rp ${formatNumber(grandTotal)}`} disabled />
                                </div>
                            </div>
                            <div className="flex justify-between">
                                <Button variant="outline" onClick={() => setStep(1)}>Kembali</Button>
                                <Button onClick={handleSubmit} disabled={!header.no_gudang || materials.length === 0 || !header.no_receipt}>
                                    Simpan data
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

        </AppLayout>
    );
}
