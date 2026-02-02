import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Pembayaran', href: '/pembayaran/payment-cost' },
    { title: 'Payment Cost', href: '/pembayaran/payment-cost' },
];

export default function PaymentCostIndex() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Payment Cost" />
            <div className="flex flex-col gap-6 p-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Payment Cost</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Halaman ini masih dalam pengembangan.
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

