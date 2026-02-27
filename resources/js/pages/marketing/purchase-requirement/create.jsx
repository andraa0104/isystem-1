import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/purchase-requirement' },
    { title: 'Tambah PR', href: '/marketing/purchase-requirement/create' },
];

const todayValue = () => {
    const date = new Date();
    return date.toISOString().slice(0, 10);
};

const renderValue = (value) =>
    value === null || value === undefined || value === '' ? '-' : value;

const parseNumber = (value) => {
    if (value === null || value === undefined || value === '') {
        return 0;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }

    const normalized = String(value).replace(/,/g, '').trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatMargin = (value) => {
    if (value === null || value === undefined || value === '') {
        return '';
    }
    const numeric = parseNumber(value);
    return Number.isFinite(numeric) ? `${numeric.toFixed(2)}%` : '';
};

const formatRupiah = (value) => {
    const numeric = parseNumber(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return '';
    }

    return `Rp ${new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: 0,
    }).format(Math.round(numeric))}`;
};

const parseRupiahInput = (value) => {
    const digitsOnly = String(value ?? '').replace(/[^\d]/g, '');
    return digitsOnly;
};

const calculateMargin = (hargaPoIn, hargaModal) => {
    const poIn = parseNumber(hargaPoIn);
    const modal = parseNumber(hargaModal);

    if (modal <= 0) {
        return '';
    }

    const margin = ((poIn - modal) / modal) * 100;
    return Number.isFinite(margin) ? margin.toFixed(2) : '';
};

const calculateTotalPrice = (qtyPr, hargaModal) => {
    const qty = parseNumber(qtyPr);
    const modal = parseNumber(hargaModal);
    if (qty <= 0 || modal <= 0) {
        return '';
    }
    return (qty * modal).toFixed(2);
};

export default function PurchaseRequirementCreate() {
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [customerPageSize, setCustomerPageSize] = useState(5);
    const [customerCurrentPage, setCustomerCurrentPage] = useState(1);
    const [customerList, setCustomerList] = useState([]);
    const [customerTotal, setCustomerTotal] = useState(0);
    const [customerLoading, setCustomerLoading] = useState(false);
    const [customerError, setCustomerError] = useState('');
    const [poinMaterialLoading, setPoinMaterialLoading] = useState(false);
    const [poinMaterialError, setPoinMaterialError] = useState('');
    const [submitError, setSubmitError] = useState('');

    const [formData, setFormData] = useState({
        date: todayValue(),
        refPo: '',
        forCustomer: '',
        payment: 'Cash Trans',
    });

    const [materialItems, setMaterialItems] = useState([]);

    const customerTotalPages = useMemo(() => {
        if (customerPageSize === Infinity) {
            return 1;
        }
        return Math.max(1, Math.ceil(customerTotal / customerPageSize));
    }, [customerTotal, customerPageSize]);

    const loadCustomers = async () => {
        setCustomerLoading(true);
        setCustomerError('');

        try {
            const params = new URLSearchParams();
            params.set('per_page', customerPageSize === Infinity ? 'all' : String(customerPageSize));
            params.set('page', String(customerCurrentPage));
            if (customerSearchTerm.trim()) {
                params.set('search', customerSearchTerm.trim());
            }

            const response = await fetch(
                `/marketing/purchase-requirement/customers?${params.toString()}`,
                { headers: { Accept: 'application/json' } }
            );

            if (!response.ok) {
                throw new Error('Request failed');
            }

            const data = await response.json();
            setCustomerList(Array.isArray(data?.customers) ? data.customers : []);
            setCustomerTotal(Number(data?.total ?? 0));
        } catch {
            setCustomerError('Gagal memuat data PO In.');
        } finally {
            setCustomerLoading(false);
        }
    };

    useEffect(() => {
        if (isCustomerModalOpen) {
            loadCustomers();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCustomerModalOpen, customerCurrentPage, customerPageSize, customerSearchTerm]);

    const loadPoInMaterials = async (kodePoin) => {
        if (!kodePoin) {
            setMaterialItems([]);
            return;
        }

        setPoinMaterialLoading(true);
        setPoinMaterialError('');

        try {
            const params = new URLSearchParams();
            params.set('kode_poin', kodePoin);

            const response = await fetch(
                `/marketing/purchase-requirement/poin-details?${params.toString()}`,
                { headers: { Accept: 'application/json' } }
            );

            if (!response.ok) {
                throw new Error('Request failed');
            }

            const data = await response.json();
            const items = Array.isArray(data?.items) ? data.items : [];

            setMaterialItems(
                items.map((item, index) => ({
                    id: item.id ?? `${Date.now()}-${index}`,
                    no: item.line_no ?? index + 1,
                    kodeMaterial: item.kd_material ?? '',
                    namaMaterial: item.material ?? '',
                    stok: item.stok ?? 0,
                    qtyPoIn: item.qty_po_in ?? 0,
                    qtyPr: item.qty_pr ?? item.qty_po_in ?? 0,
                    satuan: item.satuan ?? '',
                    hargaPoIn: item.harga_po_in ?? 0,
                    hargaModal: item.harga_modal ?? '',
                    margin: item.margin ?? '',
                    remark: item.remark ?? '',
                }))
            );
        } catch {
            setMaterialItems([]);
            setPoinMaterialError('Gagal memuat material dari PO In terpilih.');
        } finally {
            setPoinMaterialLoading(false);
        }
    };

    const handleQtyPrChange = (id, value) => {
        setMaterialItems((prev) =>
            prev.map((item) => {
                if (item.id !== id) {
                    return item;
                }
                const qtyPr = value;
                return {
                    ...item,
                    qtyPr,
                };
            })
        );
    };

    const handleHargaModalChange = (id, value) => {
        setMaterialItems((prev) =>
            prev.map((item) => {
                if (item.id !== id) {
                    return item;
                }

                const hargaModal = value;
                return {
                    ...item,
                    hargaModal,
                    margin: calculateMargin(item.hargaPoIn, hargaModal),
                };
            })
        );
    };

    const handleRemarkChange = (id, value) => {
        setMaterialItems((prev) =>
            prev.map((item) =>
                item.id === id
                    ? {
                          ...item,
                          remark: value,
                      }
                    : item
            )
        );
    };

    const handleRemoveMaterial = (id) => {
        setMaterialItems((prev) => prev.filter((item) => item.id !== id));
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        setSubmitError('');

        if (materialItems.length === 0) {
            setSubmitError('Belum ada material dari PO In yang dipilih.');
            return;
        }

        const hasInvalidRow = materialItems.some(
            (item) => parseNumber(item.hargaModal) <= 0 || parseNumber(item.qtyPr) < 0
        );
        if (hasInvalidRow) {
            setSubmitError('Harga modal wajib diisi dan Qty PR tidak boleh negatif.');
            return;
        }

        router.post(
            '/marketing/purchase-requirement',
            {
                date: formData.date,
                payment: formData.payment,
                for_customer: formData.forCustomer,
                ref_po: formData.refPo,
                materials: materialItems.map((item, index) => ({
                    no: index + 1,
                    detail_id: item.id,
                    kd_material: item.kodeMaterial,
                    material: item.namaMaterial,
                    qty: item.qtyPr,
                    unit: item.satuan,
                    stok: item.stok,
                    unit_price: item.hargaModal,
                    total_price: calculateTotalPrice(item.qtyPr, item.hargaModal),
                    price_po: item.hargaPoIn,
                    margin: item.margin,
                    renmark: item.remark,
                })),
            },
            {
                onStart: () => setIsSubmitting(true),
                onFinish: () => setIsSubmitting(false),
            }
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Tambah PR" />
            <form className="flex h-full flex-1 flex-col gap-4 p-4" onSubmit={handleSubmit}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Tambah PR</h1>
                        <p className="text-sm text-muted-foreground">Isi data PR dalam dua langkah</p>
                    </div>
                    <div className="text-sm text-muted-foreground">Step {step} dari 2</div>
                </div>

                <div className="flex flex-wrap gap-3 text-sm">
                    <span
                        className={`rounded-full px-3 py-1 ${
                            step === 1
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                        }`}
                    >
                        1. Data PO Masuk
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
                            <CardTitle>Data PO Masuk</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">Date</span>
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
                                <span className="text-muted-foreground">Ref PO</span>
                                <Input
                                    value={formData.refPo}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            refPo: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">For Customer</span>
                                <div className="flex gap-2">
                                    <Input value={formData.forCustomer} readOnly />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            setIsCustomerModalOpen(true);
                                            setCustomerCurrentPage(1);
                                            setCustomerSearchTerm('');
                                            setCustomerList([]);
                                            setCustomerTotal(0);
                                        }}
                                    >
                                        Cari PO In
                                    </Button>
                                </div>
                            </label>
                            <label className="space-y-2 text-sm">
                                <span className="text-muted-foreground">Payment</span>
                                <select
                                    className="h-9 w-full rounded-md border border-sidebar-border/70 bg-background px-3 text-sm"
                                    value={formData.payment}
                                    onChange={(event) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            payment: event.target.value,
                                        }))
                                    }
                                >
                                    <option value="Cash Trans">Cash Trans</option>
                                    <option value="Cash Tunai">Cash Tunai</option>
                                    <option value="Credit">Credit</option>
                                </select>
                            </label>
                        </CardContent>
                        <div className="flex justify-end gap-2 px-6 pb-6">
                            <Button type="button" onClick={() => setStep(2)}>
                                Lanjut
                            </Button>
                        </div>
                    </Card>
                )}

                {step === 2 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Data Material</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            {submitError && (
                                <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                    {submitError}
                                </div>
                            )}

                            {poinMaterialLoading && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Spinner />
                                    Memuat material dari PO In...
                                </div>
                            )}

                            {poinMaterialError && (
                                <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                    {poinMaterialError}
                                </div>
                            )}

                            <div className="space-y-4">
                                {materialItems.length === 0 && (
                                    <div className="rounded-xl border border-sidebar-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
                                        Belum ada material. Pilih PO In terlebih dahulu.
                                    </div>
                                )}

                                {materialItems.map((item, index) => (
                                    <div
                                        key={item.id}
                                        className="rounded-xl border border-sidebar-border/70 bg-card p-4"
                                    >
                                        <div className="mb-4 flex items-start justify-between gap-3">
                                            <div className="space-y-1">
                                                <p className="text-xs font-medium text-muted-foreground">
                                                    No. {index + 1}
                                                </p>
                                                <p
                                                    title={String(item.namaMaterial ?? '')}
                                                    className="text-sm font-semibold leading-snug"
                                                >
                                                    {renderValue(item.namaMaterial)}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Kode: {renderValue(item.kodeMaterial)}
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                title="Hapus material"
                                                onClick={() => handleRemoveMaterial(item.id)}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                <span className="sr-only">Hapus</span>
                                            </Button>
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                                            <div className="grid gap-2">
                                                <Label>Margin (%)</Label>
                                                <Input value={formatMargin(item.margin)} readOnly />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Stok</Label>
                                                <Input value={renderValue(item.stok)} readOnly />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Qty PO In</Label>
                                                <Input value={renderValue(item.qtyPoIn)} readOnly />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Qty PR</Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    placeholder="0"
                                                    className="h-9"
                                                    value={item.qtyPr}
                                                    onChange={(event) =>
                                                        handleQtyPrChange(item.id, event.target.value)
                                                    }
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Satuan</Label>
                                                <Input value={renderValue(item.satuan)} readOnly />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Harga PO In</Label>
                                                <Input value={formatRupiah(item.hargaPoIn)} readOnly />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Harga Modal</Label>
                                                <Input
                                                    type="text"
                                                    inputMode="numeric"
                                                    placeholder="Isi modal"
                                                    className="h-9"
                                                    value={formatRupiah(item.hargaModal)}
                                                    onChange={(event) =>
                                                        handleHargaModalChange(
                                                            item.id,
                                                            parseRupiahInput(event.target.value)
                                                        )
                                                    }
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Total Price Modal</Label>
                                                <Input
                                                    value={formatRupiah(
                                                        calculateTotalPrice(item.qtyPr, item.hargaModal)
                                                    )}
                                                    readOnly
                                                />
                                            </div>
                                            <div className="grid gap-2 xl:col-span-2">
                                                <Label>Remark</Label>
                                                <Input
                                                    className="h-9"
                                                    value={item.remark}
                                                    onChange={(event) =>
                                                        handleRemarkChange(item.id, event.target.value)
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                        <div className="flex justify-between gap-2 px-6 pb-6">
                            <Button variant="outline" type="button" onClick={() => setStep(1)}>
                                Kembali
                            </Button>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Spinner className="mr-2" />}
                                    {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                                </Button>
                                <Button variant="outline" asChild>
                                    <Link href="/marketing/purchase-requirement">Batal</Link>
                                </Button>
                            </div>
                        </div>
                    </Card>
                )}

                <Dialog
                    open={isCustomerModalOpen}
                    onOpenChange={(open) => {
                        setIsCustomerModalOpen(open);
                        if (!open) {
                            setCustomerSearchTerm('');
                            setCustomerPageSize(5);
                            setCustomerCurrentPage(1);
                            setCustomerList([]);
                            setCustomerTotal(0);
                        }
                    }}
                >
                    <DialogContent className="!left-0 !top-0 !h-screen !w-screen !translate-x-0 !translate-y-0 !max-w-none !rounded-none overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Pilih PO In</DialogTitle>
                            <DialogDescription>
                                Pilih PO In untuk mengisi Ref PO, customer, dan detail material.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <label>
                                Tampilkan
                                <select
                                    className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-sm"
                                    value={customerPageSize === Infinity ? 'all' : customerPageSize}
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setCustomerPageSize(value === 'all' ? Infinity : Number(value));
                                        setCustomerCurrentPage(1);
                                    }}
                                >
                                    <option value={5}>5</option>
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
                                    placeholder="Cari kode PO In, no PO In, customer..."
                                    value={customerSearchTerm}
                                    onChange={(event) => {
                                        setCustomerSearchTerm(event.target.value);
                                        setCustomerCurrentPage(1);
                                    }}
                                />
                            </label>
                            <Button type="button" variant="outline" onClick={loadCustomers}>
                                Refresh
                            </Button>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-sidebar-border/70">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Kode PO In</th>
                                        <th className="px-4 py-3 text-left">No PO In</th>
                                        <th className="px-4 py-3 text-left">Date</th>
                                        <th className="px-4 py-3 text-left">Customer</th>
                                        <th className="px-4 py-3 text-left">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {customerList.length === 0 && (
                                        <tr>
                                            <td
                                                className="px-4 py-6 text-center text-muted-foreground"
                                                colSpan={5}
                                            >
                                                {customerLoading
                                                    ? 'Memuat data PO In...'
                                                    : customerError || 'Tidak ada data PO In.'}
                                            </td>
                                        </tr>
                                    )}
                                    {customerList.map((item) => (
                                        <tr
                                            key={`${item.kode_poin}-${item.no_poin}`}
                                            className="border-t border-sidebar-border/70"
                                        >
                                            <td className="px-4 py-3">{renderValue(item.kode_poin)}</td>
                                            <td className="px-4 py-3">{renderValue(item.no_poin)}</td>
                                            <td className="px-4 py-3">{renderValue(item.date_poin)}</td>
                                            <td className="px-4 py-3">{renderValue(item.customer_name)}</td>
                                            <td className="px-4 py-3">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setFormData((prev) => ({
                                                            ...prev,
                                                            refPo: item.no_poin ?? '',
                                                            forCustomer: item.customer_name ?? '',
                                                        }));
                                                        setIsCustomerModalOpen(false);
                                                        loadPoInMaterials(item.kode_poin ?? '');
                                                        setStep(2);
                                                    }}
                                                >
                                                    Pilih
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {customerPageSize !== Infinity && customerTotal > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                <span>
                                    Menampilkan {Math.min((customerCurrentPage - 1) * customerPageSize + 1, customerTotal)}-
                                    {Math.min(customerCurrentPage * customerPageSize, customerTotal)} dari {customerTotal} data
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setCustomerCurrentPage((p) => Math.max(1, p - 1))
                                        }
                                        disabled={customerCurrentPage === 1}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span className="text-sm text-muted-foreground">
                                        Halaman {customerCurrentPage} dari {customerTotalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setCustomerCurrentPage((p) => Math.min(customerTotalPages || p, p + 1))
                                        }
                                        disabled={customerCurrentPage >= customerTotalPages}
                                    >
                                        Berikutnya
                                    </Button>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </form>
        </AppLayout>
    );
}
