import { SidebarInset } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { router, usePage } from '@inertiajs/react';
import { AnimatePresence, motion } from 'motion/react';
import * as React from 'react';

export function AppContent({
    variant = 'header',
    children,
    className,
    ...props
}) {
    const { url } = usePage();
    const pageKey = React.useMemo(() => String(url || '').split('?')[0], [url]);

    const [isLoading, setIsLoading] = React.useState(false);

    React.useEffect(() => {
        const shouldSkipOverlay = (visit) => {
            const headers = visit?.headers ?? {};
            const value =
                headers['X-Skip-Loading-Overlay'] ??
                headers['x-skip-loading-overlay'];
            return String(value ?? '').toLowerCase() === '1';
        };

        const removeStart = router.on('start', (event) => {
            if (event.detail.visit?.prefetch) {
                return;
            }
            if (shouldSkipOverlay(event.detail.visit)) {
                return;
            }
            setIsLoading(true);
        });
        const removeNavigate = router.on('navigate', () => {
            setIsLoading(false);
        });
        const removeFinish = router.on('finish', () => {
            setIsLoading(false);
        });

        return () => {
            removeStart();
            removeNavigate();
            removeFinish();
        };
    }, []);

    const loadingOverlay = (
        <AnimatePresence>
            {isLoading && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="absolute inset-0 z-40 bg-background/45 backdrop-blur-[1px]"
                >
                    <div className="sticky top-[50vh] flex -translate-y-1/2 justify-center">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            transition={{ duration: 0.15 }}
                            className="flex items-center rounded-2xl border border-emerald-500/25 bg-card/95 px-4 py-2.5 text-foreground shadow-xl shadow-emerald-500/10 backdrop-blur-xl"
                        >
                            <span className="text-xs font-bold tracking-wide">
                                Memuat halaman...
                            </span>
                        </motion.div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    const animatedChildren = (
        <motion.div
            key={pageKey}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-1 flex-col min-w-0"
        >
            {children}
        </motion.div>
    );

    if (variant === 'sidebar') {
        return (
            <SidebarInset {...props} className={cn('relative', className)}>
                {animatedChildren}
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
            {animatedChildren}
            {loadingOverlay}
        </main>
    );
}
