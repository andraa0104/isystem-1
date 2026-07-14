import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import Swal from 'sweetalert2';

export default function AppSidebarLayout({ children, breadcrumbs = [] }) {
    const { flash = {}, errors = {} } = usePage().props;
    const pendingToastKey = 'app:pending-toast';

    const showToast = (message, variant) => {
        if (!message) {
            return;
        }

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: variant === 'success' ? 'success' : 'error',
            title: message,
            showConfirmButton: false,
            timer: variant === 'success' ? 2600 : 3600,
            timerProgressBar: true,
        });
    };

    useEffect(() => {
        const pendingToast = window.sessionStorage.getItem(pendingToastKey);
        if (pendingToast) {
            try {
                const parsed = JSON.parse(pendingToast);
                showToast(
                    parsed?.message,
                    parsed?.variant === 'success' ? 'success' : 'error',
                );
            } catch {
                showToast(pendingToast, 'success');
            } finally {
                window.sessionStorage.removeItem(pendingToastKey);
            }
        }

        if (flash?.success) {
            showToast(flash.success, 'success');
            return;
        }

        if (flash?.error) {
            showToast(flash.error, 'error');
            return;
        }

        const errorValues = Object.values(errors ?? {});
        if (errorValues.length > 0) {
            const firstError = Array.isArray(errorValues[0])
                ? errorValues[0][0]
                : errorValues[0];
            showToast(firstError, 'error');
        }
    }, [errors, flash?.error, flash?.success]);

    useEffect(() => {
        const onGlobalToast = (event) => {
            const detail = event?.detail ?? {};
            const message = detail?.message;
            const variant = detail?.variant === 'success' ? 'success' : 'error';
            showToast(message, variant);
        };

        window.addEventListener('app:toast', onGlobalToast);

        return () => {
            window.removeEventListener('app:toast', onGlobalToast);
        };
    }, []);

    return (
        <AppShell variant="sidebar">
            <AppSidebar />
            <AppContent variant="sidebar" className="overflow-x-hidden">
                <AppSidebarHeader breadcrumbs={breadcrumbs} />
                {children}
            </AppContent>
        </AppShell>
    );
}
