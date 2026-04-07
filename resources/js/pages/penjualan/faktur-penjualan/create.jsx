import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
import { FileText, Hash, Package, Search, Trash2, User } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Penjualan', href: '/penjualan/faktur-penjualan' },
    { title: 'Tambah Invoice', href: '/penjualan/faktur-penjualan/create' },
];

const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
};

const addMonths = (date, months) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
};

const toNumber = (value) => {
    const number = Number(value);
    return Number.isNaN(number) ? 0 : number;
};

const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(
        toNumber(value),
    );

const formatRupiah = (value) => `Rp. ${formatNumber(value)}`;
const formatInvoiceNumber = (value) => {
    const raw = String(value ?? '').trim();
    if (!raw || raw === '0') {
        return raw === '' ? '' : '0';
    }
    const digits = raw.replace(/\D/g, '');
    const part1 = digits.slice(0, 3);
    const part2 = digits.slice(3, 6);
    const part3 = digits.slice(6, 8);
    const part4 = digits.slice(8);
    return [part1, part2, part3, part4].filter(Boolean).join('.');
};

export default function FakturPenjualanCreate() {
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isOutstandingOpen, setIsOutstandingOpen] = useState(false);
    const [outstandingLoading, setOutstandingLoading] = useState(false);
    const [outstandingError, setOutstandingError] = useState('');
    const [outstandingList, setOutstandingList] = useState([]);
    const [outstandingSearchTerm, setOutstandingSearchTerm] = useState('');
    const [outstandingPageSize, setOutstandingPageSize] = useState(5);
    const [outstandingCurrentPage, setOutstandingCurrentPage] = useState(1);

    const [doMaterials, setDoMaterials] = useState([]);
    const [doAddMaterials, setDoAddMaterials] = useState([]);
    const [materialsLoading, setMaterialsLoading] = useState(false);
    const [materialInput, setMaterialInput] = useState({
        no_ref: '',
        kd_material: '',
        material: '',
        qty: '',
        unit: '',
        price: '',
        total: '',
        hpp: '',
        total_hpp: '',
        source_type: '',
    });
    const [materialRows, setMaterialRows] = useState([]);

    const today = formatDate(new Date());
    const [formData, setFormData] = useState({
        date: today,
        dueDate: formatDate(addMonths(new Date(), 1)),
        no_do: '',
        ref_po_in: '',
        kd_cs: '',
        nm_cs: '',
        ppn: '',
        no_invoice: '0',
    });

    const filteredOutstanding = useMemo(() => {
        const term = outstandingSearchTerm.trim().toLowerCase();
        if (!term) {
            return outstandingList;
        }
        return outstandingList.filter((item) => {
            return (
                String(item.no_do ?? '')
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
    }, [outstandingList, outstandingSearchTerm]);

    const outstandingTotalItems = filteredOutstanding.length;
    const outstandingTotalPages = useMemo(() => {
        if (outstandingPageSize === Infinity) {
            return 1;
        }
        return Math.max(
            1,
            Math.ceil(outstandingTotalItems / outstandingPageSize),
        );
    }, [outstandingPageSize, outstandingTotalItems]);

    const displayedOutstanding = useMemo(() => {
        if (outstandingPageSize === Infinity) {
            return filteredOutstanding;
        }
        const startIndex = (outstandingCurrentPage - 1) * outstandingPageSize;
        return filteredOutstanding.slice(
            startIndex,
            startIndex + outstandingPageSize,
        );
    }, [filteredOutstanding, outstandingCurrentPage, outstandingPageSize]);

    const loadOutstanding = () => {
        if (outstandingLoading || outstandingList.length > 0) {
            return;
        }
        setOutstandingLoading(true);
        setOutstandingError('');
        fetch('/penjualan/faktur-penjualan/outstanding-do', {
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
                    Array.isArray(data?.deliveryOrders)
                        ? data.deliveryOrders
                        : [],
                );
            })
            .catch(() => {
                setOutstandingList([]);
                setOutstandingError('Gagal memuat data DO outstanding.');
            })
            .finally(() => {
                setOutstandingLoading(false);
            });
    };

    useEffect(() => {
        if (isOutstandingOpen) {
            loadOutstanding();
        }
    }, [isOutstandingOpen]);

    useEffect(() => {
        setOutstandingCurrentPage(1);
    }, [outstandingPageSize, outstandingSearchTerm]);

    useEffect(() => {
        if (outstandingCurrentPage > outstandingTotalPages) {
            setOutstandingCurrentPage(outstandingTotalPages);
        }
    }, [outstandingCurrentPage, outstandingTotalPages]);

    const handleSelectOutstanding = (item) => {
        setFormData((prev) => ({
            ...prev,
            no_do: item.no_do ?? '',
            ref_po_in: item.ref_po ?? '',
            kd_cs: item.kd_cs ?? '',
            nm_cs: item.nm_cs ?? '',
        }));
        setIsOutstandingOpen(false);
    };

    const handleSelectMaterial = (item, type) => {
        const qty = toNumber(item.qty);
        const hpp = toNumber(item.hpp);
        setMaterialInput({
            no_ref: type === 'do' ? (item.no_do ?? '') : (item.no_dob ?? ''),
            kd_material: item.kd_material ?? '',
            material: item.mat ?? '',
            qty: item.qty ?? '',
            unit: item.unit ?? '',
            price: item.harga ?? '',
            total: item.total ?? '',
            hpp: item.hpp ?? '',
            total_hpp: qty * hpp,
            source_type: type,
        });
    };

    const handleMaterialInputChange = (event) => {
        const { name, value } = event.target;
        setMaterialInput((prev) => {
            const next = { ...prev, [name]: value };
            if (name === 'qty' || name === 'hpp' || name === 'price') {
                const qty = toNumber(name === 'qty' ? value : next.qty);
                const hpp = toNumber(name === 'hpp' ? value : next.hpp);
                const price = toNumber(name === 'price' ? value : next.price);
                next.total_hpp = qty * hpp;
                next.total = qty * price;
            }
            return next;
        });
    };

    const handleAddMaterialRow = () => {
        if (!materialInput.material) {
            return;
        }
        setMaterialRows((prev) => [
            ...prev,
            {
                ...materialInput,
                total_hpp:
                    toNumber(materialInput.qty) * toNumber(materialInput.hpp),
            },
        ]);
        setMaterialInput({
            no_ref: '',
            kd_material: '',
            material: '',
            qty: '',
            unit: '',
            price: '',
            total: '',
            hpp: '',
            total_hpp: '',
            source_type: '',
        });
    };

    useEffect(() => {
        const dateValue = formData.date;
        if (!dateValue) {
            return;
        }
        const nextDue = formatDate(addMonths(dateValue, 1));
        setFormData((prev) => ({
            ...prev,
            dueDate: nextDue,
        }));
    }, [formData.date]);

    useEffect(() => {
        if (step !== 2 || !formData.no_do) {
            setDoMaterials([]);
            setDoAddMaterials([]);
            return;
        }
        setMaterialsLoading(true);
        Promise.all([
            fetch(
                `/penjualan/faktur-penjualan/do-materials?no_do=${encodeURIComponent(
                    formData.no_do,
                )}&ref_po_in=${encodeURIComponent(formData.ref_po_in)}`,
                { headers: { Accept: 'application/json' } },
            ),
            fetch(
                `/penjualan/faktur-penjualan/do-add-materials?no_do=${encodeURIComponent(
                    formData.no_do,
                )}&ref_po_in=${encodeURIComponent(formData.ref_po_in)}`,
                { headers: { Accept: 'application/json' } },
            ),
        ])
            .then(async ([doResponse, doAddResponse]) => {
                if (!doResponse.ok || !doAddResponse.ok) {
                    throw new Error('Request failed');
                }
                const doData = await doResponse.json();
                const doAddData = await doAddResponse.json();
                setDoMaterials(
                    Array.isArray(doData?.items) ? doData.items : [],
                );
                setDoAddMaterials(
                    Array.isArray(doAddData?.items) ? doAddData.items : [],
                );
            })
            .catch(() => {
                setDoMaterials([]);
                setDoAddMaterials([]);
            })
            .finally(() => setMaterialsLoading(false));
    }, [step, formData.no_do, formData.ref_po_in]);

    const grandTotalPrice = useMemo(() => {
        return materialRows.reduce(
            (total, item) => total + toNumber(item.total),
            0,
        );
    }, [materialRows]);

    const grandTotalHpp = useMemo(() => {
        return materialRows.reduce(
            (total, item) => total + toNumber(item.total_hpp),
            0,
        );
    }, [materialRows]);

    const totalPpn = useMemo(() => {
        const ppnValue = toNumber(formData.ppn);
        return (ppnValue / 100) * grandTotalPrice;
    }, [formData.ppn, grandTotalPrice]);

    const margin = useMemo(() => {
        if (!grandTotalPrice) {
            return 0;
        }
        return ((grandTotalPrice - grandTotalHpp) / grandTotalPrice) * 100;
    }, [grandTotalPrice, grandTotalHpp]);

    const grandTotalWithPpn = useMemo(() => {
        return grandTotalPrice + totalPpn;
    }, [grandTotalPrice, totalPpn]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Tambah Invoice" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">
                            Tambah Invoice
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Isi data invoice dalam dua langkah
                        </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                        Step {step} dari 2
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 text-sm">
                    <span
                        className={`rounded-full px-3 py-1 ${
                            step === 1
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                        }`}
                    >
                        1. Data DO
                    </span>
                    <span
                        className={`rounded-full px-3 py-1 ${
                            step === 2
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                        }`}
                    >
                        2. Data Material
                    </span>
                </div>

                {step === 1 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Data DO</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2 text-sm md:col-span-2">
                                <span className="text-muted-foreground">
                                    Cari DO Outstanding
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full justify-start gap-2"
                                    onClick={() => setIsOutstandingOpen(true)}
                                >
                                    <Search className="h-4 w-4" />
                                    Pilih DO outstanding
                                </Button>
                            </div>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Date
                                </span>
                                <Input
                                    type="date"
                                    value={formData.date}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            date: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Jatuh Tempo
                                </span>
                                <Input
                                    type="date"
                                    value={formData.dueDate}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            dueDate: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Nomor Faktur Pajak
                                </span>
                                <Input
                                    value={formatInvoiceNumber(
                                        formData.no_invoice,
                                    )}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            no_invoice:
                                                event.target.value.replace(
                                                    /\D/g,
                                                    '',
                                                ),
                                        }))
                                    }
                                />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Ref PO In
                                </span>
                                <Input value={formData.ref_po_in} readOnly />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Kode Customer
                                </span>
                                <Input value={formData.kd_cs} readOnly />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    Nama Customer
                                </span>
                                <Input value={formData.nm_cs} readOnly />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">
                                    PPN
                                </span>
                                <Input
                                    type="number"
                                    value={formData.ppn}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            ppn: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                        </CardContent>
                        <div className="flex justify-end gap-2 px-6 pb-6">
                            <Button
                                type="button"
                                onClick={() => setStep(2)}
                                disabled={!formData.no_do}
                            >
                                Lanjut
                            </Button>
                        </div>
                    </Card>
                )}

                {step === 2 && (
                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>List Data Material DO</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>No</TableHead>
                                            <TableHead>No DO</TableHead>
                                            <TableHead>Material</TableHead>
                                            <TableHead>Qty</TableHead>
                                            <TableHead>Satuan</TableHead>
                                            <TableHead>Price</TableHead>
                                            <TableHead>Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {materialsLoading &&
                                            doMaterials.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={7}>
                                                        Memuat data material
                                                        DO...
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        {!materialsLoading &&
                                            doMaterials.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={7}>
                                                        Tidak ada data material
                                                        DO.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        {doMaterials.map((item, index) => (
                                            <TableRow
                                                key={`do-${item.no_do ?? item.mat}-${index}`}
                                                className="cursor-pointer hover:bg-muted/60"
                                                onClick={() =>
                                                    handleSelectMaterial(
                                                        item,
                                                        'do',
                                                    )
                                                }
                                            >
                                                <TableCell>
                                                    {index + 1}
                                                </TableCell>
                                                <TableCell>
                                                    {item.no_do}
                                                </TableCell>
                                                <TableCell>
                                                    {item.mat}
                                                </TableCell>
                                                <TableCell>
                                                    {item.qty}
                                                </TableCell>
                                                <TableCell>
                                                    {item.unit}
                                                </TableCell>
                                                <TableCell>
                                                    {formatRupiah(item.harga)}
                                                </TableCell>
                                                <TableCell>
                                                    {formatRupiah(item.total)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>List Data Material DO Add</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>No</TableHead>
                                            <TableHead>No DOT</TableHead>
                                            <TableHead>Material</TableHead>
                                            <TableHead>Qty</TableHead>
                                            <TableHead>Satuan</TableHead>
                                            <TableHead>Price</TableHead>
                                            <TableHead>Total</TableHead>
                                            <TableHead>Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {materialsLoading &&
                                            doAddMaterials.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={7}>
                                                        Memuat data material DO
                                                        Add...
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        {!materialsLoading &&
                                            doAddMaterials.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={7}>
                                                        Tidak ada data material
                                                        DO Add.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        {doAddMaterials.map((item, index) => (
                                            <TableRow
                                                key={`do-add-${item.no_dob ?? item.mat}-${index}`}
                                                className="cursor-pointer hover:bg-muted/60"
                                                onClick={() =>
                                                    handleSelectMaterial(
                                                        item,
                                                        'dot',
                                                    )
                                                }
                                            >
                                                <TableCell>
                                                    {index + 1}
                                                </TableCell>
                                                <TableCell>
                                                    {item.no_dob}
                                                </TableCell>
                                                <TableCell>
                                                    {item.mat}
                                                </TableCell>
                                                <TableCell>
                                                    {item.qty}
                                                </TableCell>
                                                <TableCell>
                                                    {item.unit}
                                                </TableCell>
                                                <TableCell>
                                                    {formatRupiah(item.harga)}
                                                </TableCell>
                                                <TableCell>
                                                    {formatRupiah(item.total)}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <button
                                                        type="button"
                                                        className="text-destructive hover:text-destructive/80"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDoAddMaterials(
                                                                (prev) =>
                                                                    prev.filter(
                                                                        (
                                                                            _,
                                                                            i,
                                                                        ) =>
                                                                            i !==
                                                                            index,
                                                                    ),
                                                            );
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Detail Material</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label>Nomor DO/DOT</Label>
                                    <Input
                                        name="no_ref"
                                        value={materialInput.no_ref}
                                        onChange={handleMaterialInputChange}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Kode Material</Label>
                                    <Input
                                        name="kd_material"
                                        value={materialInput.kd_material}
                                        onChange={handleMaterialInputChange}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Material</Label>
                                    <Input
                                        name="material"
                                        value={materialInput.material}
                                        onChange={handleMaterialInputChange}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Qty</Label>
                                    <Input
                                        name="qty"
                                        value={materialInput.qty}
                                        onChange={handleMaterialInputChange}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Satuan</Label>
                                    <Input
                                        name="unit"
                                        value={materialInput.unit}
                                        onChange={handleMaterialInputChange}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Price</Label>
                                    <Input
                                        value={formatRupiah(
                                            materialInput.price,
                                        )}
                                        readOnly
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Total Price</Label>
                                    <Input
                                        value={formatRupiah(
                                            materialInput.total,
                                        )}
                                        readOnly
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>HPP</Label>
                                    <Input
                                        value={formatRupiah(materialInput.hpp)}
                                        readOnly
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Total HPP</Label>
                                    <Input
                                        value={formatRupiah(
                                            materialInput.total_hpp,
                                        )}
                                        readOnly
                                    />
                                </div>
                                <div className="flex items-end">
                                    <Button
                                        type="button"
                                        onClick={handleAddMaterialRow}
                                    >
                                        Tambah Data
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Data Material DO dan DOT</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>No</TableHead>
                                            <TableHead>No DO/DOT</TableHead>
                                            <TableHead>Kode Material</TableHead>
                                            <TableHead>Material</TableHead>
                                            <TableHead>Qty</TableHead>
                                            <TableHead>Satuan</TableHead>
                                            <TableHead>Price</TableHead>
                                            <TableHead>Total Price</TableHead>
                                            <TableHead>Hpp</TableHead>
                                            <TableHead>Total Hpp</TableHead>
                                            <TableHead>Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {materialRows.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={10}>
                                                    Belum ada data material.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {materialRows.map((item, index) => (
                                            <TableRow
                                                key={`material-${item.no_ref}-${index}`}
                                            >
                                                <TableCell>
                                                    {index + 1}
                                                </TableCell>
                                                <TableCell>
                                                    {item.no_ref}
                                                </TableCell>
                                                <TableCell>
                                                    {item.kd_material}
                                                </TableCell>
                                                <TableCell>
                                                    {item.material}
                                                </TableCell>
                                                <TableCell>
                                                    {item.qty}
                                                </TableCell>
                                                <TableCell>
                                                    {item.unit}
                                                </TableCell>
                                                <TableCell>
                                                    {formatRupiah(item.price)}
                                                </TableCell>
                                                <TableCell>
                                                    {formatRupiah(item.total)}
                                                </TableCell>
                                                <TableCell>
                                                    {formatRupiah(item.hpp)}
                                                </TableCell>
                                                <TableCell>
                                                    {formatRupiah(
                                                        item.total_hpp,
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <button
                                                        type="button"
                                                        className="text-destructive hover:text-destructive/80"
                                                        onClick={() =>
                                                            setMaterialRows(
                                                                (prev) =>
                                                                    prev.filter(
                                                                        (
                                                                            _,
                                                                            i,
                                                                        ) =>
                                                                            i !==
                                                                            index,
                                                                    ),
                                                            )
                                                        }
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Ringkasan</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label>Grand Total Price</Label>
                                    <Input
                                        value={formatRupiah(grandTotalPrice)}
                                        readOnly
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Total PPN</Label>
                                    <Input
                                        value={formatRupiah(totalPpn)}
                                        readOnly
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Grand Total HPP</Label>
                                    <Input
                                        value={formatRupiah(grandTotalHpp)}
                                        readOnly
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Margin</Label>
                                    <Input
                                        value={`${formatNumber(margin)}%`}
                                        readOnly
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Grand Total Price + PPN</Label>
                                    <Input
                                        value={formatRupiah(grandTotalWithPpn)}
                                        readOnly
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex justify-between gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setStep(1)}
                            >
                                Kembali
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSubmit}
                                disabled={
                                    isSubmitting || materialRows.length === 0
                                }
                            >
                                Tambah Invoice
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <Dialog
                open={isOutstandingOpen}
                onOpenChange={setIsOutstandingOpen}
            >
                <DialogContent className="flex h-[100dvh] w-screen max-w-none flex-col overflow-hidden p-0 sm:h-[85vh] sm:w-[95vw] sm:max-w-5xl sm:rounded-2xl">
                    <DialogHeader className="shrink-0 border-b bg-background/80 px-6 py-4 backdrop-blur">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <Package className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-semibold">
                                    DO Outstanding
                                </DialogTitle>
                                <p className="text-xs text-muted-foreground">
                                    Pilih Delivery Order yang belum ditagihkan
                                </p>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="relative flex-1 sm:max-w-md">
                                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Cari No DO, Ref PO, Nama Customer..."
                                    value={outstandingSearchTerm}
                                    onChange={(event) =>
                                        setOutstandingSearchTerm(
                                            event.target.value,
                                        )
                                    }
                                    className="pl-9"
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-muted-foreground">
                                    Tampil
                                </span>
                                <select
                                    className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
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
                                    <option value={5}>5 Baris</option>
                                    <option value={10}>10 Baris</option>
                                    <option value={25}>25 Baris</option>
                                    <option value={50}>50 Baris</option>
                                    <option value="all">Semua</option>
                                </select>
                            </div>
                        </div>

                        <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border bg-card shadow-sm">
                            <div className="h-full overflow-auto overscroll-contain">
                                <Table>
                                    <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="w-[15%] px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Hash className="h-3.5 w-3.5 text-primary" />
                                                    No DO
                                                </div>
                                            </TableHead>
                                            <TableHead className="w-[25%] px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-3.5 w-3.5 text-primary" />
                                                    Ref PO
                                                </div>
                                            </TableHead>
                                            <TableHead className="w-[15%] px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Hash className="h-3.5 w-3.5 text-primary" />
                                                    Kode CS
                                                </div>
                                            </TableHead>
                                            <TableHead className="w-[45%] px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <User className="h-3.5 w-3.5 text-primary" />
                                                    Customer
                                                </div>
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {outstandingLoading && (
                                            <>
                                                {Array.from({
                                                    length:
                                                        outstandingPageSize ===
                                                        Infinity
                                                            ? 5
                                                            : outstandingPageSize,
                                                }).map((_, i) => (
                                                    <TableRow
                                                        key={`skeleton-${i}`}
                                                    >
                                                        <TableCell className="px-4 py-3">
                                                            <Skeleton className="h-4 w-24" />
                                                        </TableCell>
                                                        <TableCell className="px-4 py-3">
                                                            <Skeleton className="h-4 w-32" />
                                                        </TableCell>
                                                        <TableCell className="px-4 py-3">
                                                            <Skeleton className="h-4 w-16" />
                                                        </TableCell>
                                                        <TableCell className="px-4 py-3">
                                                            <Skeleton className="h-4 w-48" />
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </>
                                        )}
                                        {!outstandingLoading &&
                                            displayedOutstanding.length ===
                                                0 && (
                                                <TableRow>
                                                    <TableCell
                                                        colSpan={4}
                                                        className="h-32 text-center"
                                                    >
                                                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                                            <Search className="h-8 w-8 opacity-20" />
                                                            <p>
                                                                {outstandingError ||
                                                                    'Tidak ada DO outstanding.'}
                                                            </p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        {!outstandingLoading &&
                                            displayedOutstanding.map((item) => (
                                                <TableRow
                                                    key={`do-${item.no_do}`}
                                                    className="group cursor-pointer transition-colors hover:bg-primary/5"
                                                    onClick={() =>
                                                        handleSelectOutstanding(
                                                            item,
                                                        )
                                                    }
                                                >
                                                    <TableCell className="px-4 py-3 text-muted-foreground group-hover:text-primary">
                                                        {item.no_do}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 font-medium text-foreground group-hover:text-primary">
                                                        {item.ref_po}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 text-muted-foreground">
                                                        {item.kd_cs}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 font-medium text-foreground">
                                                        {item.nm_cs}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {outstandingPageSize !== Infinity &&
                            outstandingTotalItems > 0 && (
                                <div className="flex flex-col items-center justify-between gap-4 border-t pt-4 sm:flex-row">
                                    <span className="text-sm text-muted-foreground">
                                        Menampilkan{' '}
                                        <span className="font-medium text-foreground">
                                            {(outstandingCurrentPage - 1) *
                                                outstandingPageSize +
                                                1}
                                        </span>{' '}
                                        -{' '}
                                        <span className="font-medium text-foreground">
                                            {Math.min(
                                                outstandingCurrentPage *
                                                    outstandingPageSize,
                                                outstandingTotalItems,
                                            )}
                                        </span>{' '}
                                        dari{' '}
                                        <span className="font-medium text-foreground">
                                            {outstandingTotalItems}
                                        </span>{' '}
                                        data
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setOutstandingCurrentPage(
                                                    (page) =>
                                                        Math.max(1, page - 1),
                                                )
                                            }
                                            disabled={
                                                outstandingCurrentPage === 1 ||
                                                outstandingLoading
                                            }
                                            className="h-8 rounded-lg"
                                        >
                                            Sebelumnya
                                        </Button>
                                        <div className="flex items-center justify-center rounded-lg bg-muted px-3 py-1 text-sm font-medium">
                                            {outstandingCurrentPage} /{' '}
                                            {outstandingTotalPages}
                                        </div>
                                        <Button
                                            type="button"
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
                                                    outstandingTotalPages ||
                                                outstandingLoading
                                            }
                                            className="h-8 rounded-lg"
                                        >
                                            Berikutnya
                                        </Button>
                                    </div>
                                </div>
                            )}
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
const handleSubmit = () => {
    router.post(
        '/penjualan/faktur-penjualan',
        {
            date: formData.date,
            due_date: formData.dueDate,
            ref_po_in: formData.ref_po_in,
            kd_cs: formData.kd_cs,
            nm_cs: formData.nm_cs,
            ppn: formData.ppn,
            no_fakturpajak: formatInvoiceNumber(formData.no_invoice),
            materials: materialRows,
            grand_total_price: grandTotalPrice,
            total_ppn: totalPpn,
            grand_total_hpp: grandTotalHpp,
            grand_total_with_ppn: grandTotalWithPpn,
        },
        {
            onStart: () => setIsSubmitting(true),
            onFinish: () => setIsSubmitting(false),
        },
    );
};
