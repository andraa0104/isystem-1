import { Spinner } from '@/components/ui/spinner';
import { SidebarInset } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import * as React from 'react';

export function AppContent({
    variant = 'header',
    children,
    className,
    ...props
}) {
    const [isLoading, setIsLoading] = React.useState(false);
    const startedAtRef = React.useRef(0);
    const hideTimerRef = React.useRef(null);

    React.useEffect(() => {
        const MIN_VISIBLE_MS = 350;
        const clearHideTimer = () => {
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
                hideTimerRef.current = null;
            }
        };
        const hideWithMinDuration = () => {
            const elapsed = Date.now() - startedAtRef.current;
            const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
            clearHideTimer();
            hideTimerRef.current = setTimeout(() => {
                setIsLoading(false);
            }, remaining);
        };

        const removeStart = router.on('start', (event) => {
            if (event.detail.visit?.prefetch) {
                return;
            }
            clearHideTimer();
            startedAtRef.current = Date.now();
            setIsLoading(true);
        });
        const removeNavigate = router.on('navigate', () => {
            hideWithMinDuration();
        });
        const removeFinish = router.on('finish', (event) => {
            if (event.detail.visit?.prefetch) {
                return;
            }
            if (event.detail.visit?.completed === false) {
                hideWithMinDuration();
            }
        });

        return () => {
            clearHideTimer();
            removeStart();
            removeNavigate();
            removeFinish();
        };
    }, []);

    const loadingOverlay = isLoading ? (
        <div className="absolute inset-0 z-40 bg-background/45 backdrop-blur-[1px]">
            <div className="sticky top-[50vh] flex -translate-y-1/2 justify-center">
                <div className="flex items-center gap-2 rounded-lg border border-sidebar-border/70 bg-background px-4 py-3 text-muted-foreground shadow-sm">
                    <Spinner className="size-6" />
                    <span className="text-sm font-medium">Memuat halaman...</span>
                </div>
            </div>
        </div>
    ) : null;

    if (variant === 'sidebar') {
        return (
            <SidebarInset {...props} className={cn('relative', className)}>
                {children}
                {loadingOverlay}
            </SidebarInset>
        );
    }

    return (
        <main
            className={cn(
                'relative mx-auto flex h-full w-full max-w-7xl flex-1 flex-col gap-4 rounded-xl',
                className
            )}
            {...props}
        >
            {children}
            {loadingOverlay}
        </main>
    );
}
