import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import { usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

export default function AppSidebarLayout({ children, breadcrumbs = [] }) {
    const { flash = {}, errors = {} } = usePage().props;
    const [toast, setToast] = useState(null);
    const toastTimer = useRef(null);

    const showToast = (message, variant) => {
        if (!message) {
            return;
        }

        if (toastTimer.current) {
            clearTimeout(toastTimer.current);
        }

        setToast({ message, variant });
        toastTimer.current = setTimeout(() => {
            setToast(null);
        }, 4000);
    };

    useEffect(() => {
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
            if (toastTimer.current) {
                clearTimeout(toastTimer.current);
            }
        };
    }, []);

    return (
        <AppShell variant="sidebar">
            <AppSidebar />
            <AppContent variant="sidebar" className="overflow-x-hidden">
                <AppSidebarHeader breadcrumbs={breadcrumbs} />
                {children}
            </AppContent>
            {toast && (
                <div
                    className={`fixed right-4 top-4 z-50 w-[92vw] max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg ${
                        toast.variant === 'success'
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-rose-600 bg-rose-600 text-white'
                    }`}
                >
                    {toast.message}
                </div>
            )}
        </AppShell>
    );
}
