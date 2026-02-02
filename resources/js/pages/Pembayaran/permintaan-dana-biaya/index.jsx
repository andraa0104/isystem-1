import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Pembayaran', href: '/pembayaran/permintaan-dana-biaya' },
    { title: 'Permintaan Dana Biaya', href: '/pembayaran/permintaan-dana-biaya' },
];

export default function PermintaanDanaBiayaIndex() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Permintaan Dana Biaya" />
            <div className="flex flex-col gap-6 p-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Permintaan Dana Biaya</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Halaman ini masih dalam pengembangan.
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

