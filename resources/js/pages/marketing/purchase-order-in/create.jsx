import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { Head, Link } from '@inertiajs/react';
import { Landmark, PackageSearch, ReceiptText, Truck } from 'lucide-react';
import { useMemo, useState } from 'react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Marketing', href: '/marketing/purchase-order-in' },
    { title: 'Purchase Order In', href: '/marketing/purchase-order-in' },
    { title: 'Tambah PO In', href: '/marketing/purchase-order-in/create' },
];

const toNumber = (value) => {
    const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
    return Number.isNaN(parsed) ? 0 : parsed;
};

const formatRupiah = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(toNumber(value))}`;

export default function PurchaseOrderInCreate({ defaults = {}, vendors = [] }) {
    const [form, setForm] = useState({
        noPoin: '',
        date: defaults.date ?? '',
        vendor: '',
        refPo: '',
        paymentTerm: defaults.payment_term ?? '30 Hari',
        deliveryAddress: '',
        pic: '',
        note: '',
    });

    const [itemForm, setItemForm] = useState({
        material: '',
        qty: '',
        unit: 'PCS',
        unitPrice: '',
        note: '',
    });
    const [items, setItems] = useState([]);

    const handleAddItem = () => {
        if (!itemForm.material || !itemForm.qty) {
            return;
        }
        setItems((prev) => [...prev, { ...itemForm, id: `${Date.now()}-${Math.random()}` }]);
        setItemForm({
            material: '',
            qty: '',
            unit: 'PCS',
            unitPrice: '',
            note: '',
        });
    };

    const grandTotal = useMemo(
        () => items.reduce((total, item) => total + toNumber(item.qty) * toNumber(item.unitPrice), 0),
        [items]
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Tambah PO In" />
            <div className="flex h-full flex-1 flex-col gap-5 p-4">
                <section className="rounded-2xl border border-sidebar-border/70 bg-gradient-to-r from-zinc-950 via-zinc-900 to-slate-900 p-5 text-white shadow-lg">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/70">Draft Workspace</p>
                    <h1 className="mt-1 text-2xl font-semibold">Form Purchase Order In</h1>
                    <p className="mt-1 text-sm text-white/75">
                        Konsep halaman create untuk input PO In secara cepat, terstruktur, dan siap scale ke proses approval.
                    </p>
                </section>

                <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
                    <section className="grid gap-5">
                        <article className="rounded-2xl border border-sidebar-border/70 bg-background p-4 shadow-sm">
                            <div className="mb-4 flex items-center gap-2">
                                <Landmark className="size-4 text-muted-foreground" />
                                <h2 className="text-base font-semibold">Informasi Header</h2>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="no_poin">No PO In</Label>
                                    <Input
                                        id="no_poin"
                                        placeholder="Auto / manual"
                                        value={form.noPoin}
                                        onChange={(event) => setForm((prev) => ({ ...prev, noPoin: event.target.value }))}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="tanggal">Tanggal</Label>
                                    <Input
                                        id="tanggal"
                                        type="date"
                                        value={form.date}
                                        onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="vendor">Vendor</Label>
                                    <select
                                        id="vendor"
                                        className="h-10 rounded-md border border-sidebar-border/70 bg-background px-3 text-sm"
                                        value={form.vendor}
                                        onChange={(event) => setForm((prev) => ({ ...prev, vendor: event.target.value }))}
                                    >
                                        <option value="">Pilih Vendor</option>
                                        {vendors.map((vendor) => (
                                            <option key={vendor} value={vendor}>
                                                {vendor}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="ref_po">Ref PO</Label>
                                    <Input
                                        id="ref_po"
                                        placeholder="Contoh: PO-2026-0045"
                                        value={form.refPo}
                                        onChange={(event) => setForm((prev) => ({ ...prev, refPo: event.target.value }))}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="payment_term">Payment Term</Label>
                                    <Input
                                        id="payment_term"
                                        value={form.paymentTerm}
                                        onChange={(event) => setForm((prev) => ({ ...prev, paymentTerm: event.target.value }))}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="pic">PIC</Label>
                                    <Input
                                        id="pic"
                                        placeholder="Nama PIC"
                                        value={form.pic}
                                        onChange={(event) => setForm((prev) => ({ ...prev, pic: event.target.value }))}
                                    />
                                </div>
                                <div className="grid gap-2 md:col-span-2">
                                    <Label htmlFor="delivery_address">Alamat Pengiriman</Label>
                                    <textarea
                                        id="delivery_address"
                                        rows={3}
                                        className="rounded-md border border-sidebar-border/70 bg-background px-3 py-2 text-sm"
                                        value={form.deliveryAddress}
                                        onChange={(event) => setForm((prev) => ({ ...prev, deliveryAddress: event.target.value }))}
                                    />
                                </div>
                            </div>
                        </article>

                        <article className="rounded-2xl border border-sidebar-border/70 bg-background p-4 shadow-sm">
                            <div className="mb-4 flex items-center gap-2">
                                <PackageSearch className="size-4 text-muted-foreground" />
                                <h2 className="text-base font-semibold">Item Material</h2>
                            </div>
                            <div className="grid gap-4 md:grid-cols-5">
                                <div className="grid gap-2 md:col-span-2">
                                    <Label htmlFor="material">Material</Label>
                                    <Input
                                        id="material"
                                        value={itemForm.material}
                                        onChange={(event) => setItemForm((prev) => ({ ...prev, material: event.target.value }))}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="qty">Qty</Label>
                                    <Input
                                        id="qty"
                                        type="number"
                                        value={itemForm.qty}
                                        onChange={(event) => setItemForm((prev) => ({ ...prev, qty: event.target.value }))}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="unit">Satuan</Label>
                                    <Input
                                        id="unit"
                                        value={itemForm.unit}
                                        onChange={(event) => setItemForm((prev) => ({ ...prev, unit: event.target.value }))}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="price">Harga Satuan</Label>
                                    <Input
                                        id="price"
                                        value={itemForm.unitPrice}
                                        onChange={(event) => setItemForm((prev) => ({ ...prev, unitPrice: event.target.value.replace(/[^\d]/g, '') }))}
                                    />
                                </div>
                                <div className="grid gap-2 md:col-span-5">
                                    <Label htmlFor="item_note">Catatan Item</Label>
                                    <Input
                                        id="item_note"
                                        value={itemForm.note}
                                        onChange={(event) => setItemForm((prev) => ({ ...prev, note: event.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="mt-4">
                                <Button type="button" onClick={handleAddItem}>
                                    Tambah Item
                                </Button>
                            </div>

                            <div className="mt-4 overflow-x-auto rounded-xl border border-sidebar-border/70">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/40 text-muted-foreground">
                                        <tr>
                                            <th className="px-4 py-3 text-left">No</th>
                                            <th className="px-4 py-3 text-left">Material</th>
                                            <th className="px-4 py-3 text-left">Qty</th>
                                            <th className="px-4 py-3 text-left">Satuan</th>
                                            <th className="px-4 py-3 text-left">Harga Satuan</th>
                                            <th className="px-4 py-3 text-left">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.length === 0 && (
                                            <tr>
                                                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                                                    Belum ada item material.
                                                </td>
                                            </tr>
                                        )}
                                        {items.map((item, index) => (
                                            <tr key={item.id} className="border-t border-sidebar-border/70">
                                                <td className="px-4 py-3">{index + 1}</td>
                                                <td className="px-4 py-3">{item.material}</td>
                                                <td className="px-4 py-3">{item.qty}</td>
                                                <td className="px-4 py-3">{item.unit}</td>
                                                <td className="px-4 py-3">{formatRupiah(item.unitPrice)}</td>
                                                <td className="px-4 py-3">{formatRupiah(toNumber(item.qty) * toNumber(item.unitPrice))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </article>
                    </section>

                    <aside className="grid gap-5">
                        <article className="rounded-2xl border border-sidebar-border/70 bg-background p-4 shadow-sm">
                            <div className="mb-4 flex items-center gap-2">
                                <ReceiptText className="size-4 text-muted-foreground" />
                                <h2 className="text-base font-semibold">Ringkasan</h2>
                            </div>
                            <div className="space-y-3 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Jumlah Item</span>
                                    <span className="font-semibold">{items.length}</span>
                                </div>
                                <div className="flex items-center justify-between border-t border-sidebar-border/70 pt-3">
                                    <span className="text-muted-foreground">Grand Total</span>
                                    <span className="text-lg font-semibold">{formatRupiah(grandTotal)}</span>
                                </div>
                            </div>
                        </article>

                        <article className="rounded-2xl border border-sidebar-border/70 bg-background p-4 shadow-sm">
                            <div className="mb-3 flex items-center gap-2">
                                <Truck className="size-4 text-muted-foreground" />
                                <h2 className="text-base font-semibold">Catatan Dokumen</h2>
                            </div>
                            <textarea
                                rows={5}
                                className="w-full rounded-md border border-sidebar-border/70 bg-background px-3 py-2 text-sm"
                                value={form.note}
                                onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                                placeholder="Catatan internal untuk tim marketing/purchasing"
                            />
                        </article>

                        <div className="flex flex-wrap gap-2">
                            <Button className="flex-1">Simpan Draft</Button>
                            <Button variant="outline" asChild className="flex-1">
                                <Link href="/marketing/purchase-order-in">Batal</Link>
                            </Button>
                        </div>
                    </aside>
                </div>
            </div>
        </AppLayout>
    );
}
