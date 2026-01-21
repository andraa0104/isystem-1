import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';

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

export default function FakturPenjualanIndex({
    unpaidCount = 0,
    unpaidTotal = 0,
    noReceiptCount = 0,
    noReceiptTotal = 0,
    dueCount = 0,
    dueTotal = 0,
}) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Faktur Penjualan" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="transition hover:border-primary/60 hover:shadow-md">
                        <CardHeader className="space-y-2">
                            <CardTitle>Invoice Belum Dibayar</CardTitle>
                            <CardDescription>
                                Total invoice dengan pembayaran 0.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-1">
                            <p className="text-3xl font-semibold">
                                {formatNumber(unpaidCount)} Invoice
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Grand Total: {formatRupiah(unpaidTotal)}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="transition hover:border-primary/60 hover:shadow-md">
                        <CardHeader className="space-y-2">
                            <CardTitle>Invoice Belum Bikin Kwitansi</CardTitle>
                            <CardDescription>
                                Invoice tanpa nomor kwitansi.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-1">
                            <p className="text-3xl font-semibold">
                                {formatNumber(noReceiptCount)} Invoice
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Grand Total: {formatRupiah(noReceiptTotal)}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="transition hover:border-primary/60 hover:shadow-md">
                        <CardHeader className="space-y-2">
                            <CardTitle>Invoice Jatuh Tempo</CardTitle>
                            <CardDescription>
                                Jatuh tempo hari ini atau lebih lama
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-1">
                            <p className="text-3xl font-semibold">
                                {formatNumber(dueCount)} Invoice
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Grand Total: {formatRupiah(dueTotal)}
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
