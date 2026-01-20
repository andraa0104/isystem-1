import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { usePage, router } from '@inertiajs/react';
import Swal from 'sweetalert2';
export default function DeleteUser() {
    const { auth } = usePage().props;
    const handleDelete = () => {
        Swal.fire({
            title: 'Hapus akun?',
            text: 'Akun yang dihapus tidak dapat dikembalikan.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, hapus',
            cancelButtonText: 'Batal',
        }).then((result) => {
            if (!result.isConfirmed) {
                return;
            }
            router.delete('/settings/profile', {
                data: {
                    kd_user: auth.user?.kd_user ?? null,
                },
            });
        });
    };
    return (<div className="space-y-6">
            <HeadingSmall title="Delete account" description="Delete your account and all of its resources"/>
            <div className="space-y-4 rounded-lg border border-red-100 bg-red-50 p-4 dark:border-red-200/10 dark:bg-red-700/10">
                <div className="relative space-y-0.5 text-red-600 dark:text-red-100">
                    <p className="font-medium">Warning</p>
                    <p className="text-sm">
                        Please proceed with caution, this cannot be undone.
                    </p>
                </div>
                <Button variant="destructive" data-test="delete-user-button" onClick={handleDelete}>
                    Delete account
                </Button>
            </div>
        </div>);
}
