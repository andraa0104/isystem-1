import { Breadcrumbs } from '@/components/breadcrumbs';
import { useSidebar } from '@/components/ui/sidebar';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export function AppSidebarHeader({ breadcrumbs = [] }) {
    const { toggleSidebar, isMobile, state } = useSidebar();
    const isCollapsed = isMobile || state === 'collapsed';

    return (
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b border-sidebar-border/60 bg-background/80 px-4 backdrop-blur-2xl transition-[width,height] ease-linear md:h-15 md:px-6 before:pointer-events-none before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-emerald-500/25 before:to-transparent">
            <div className="flex w-full items-center gap-3">
                {/* Single Consistent Sidebar Collapse/Expand Toggle */}
                <motion.button
                    type="button"
                    data-sidebar="trigger"
                    data-slot="sidebar-trigger"
                    onClick={toggleSidebar}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.94 }}
                    aria-label={isCollapsed ? 'Buka Sidebar' : 'Tutup Sidebar'}
                    title={isCollapsed ? 'Buka Sidebar' : 'Tutup Sidebar'}
                    className="relative flex size-8 shrink-0 items-center justify-center rounded-xl border border-sidebar-border/70 bg-card/80 text-muted-foreground shadow-2xs transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                >
                    <AnimatePresence mode="wait" initial={false}>
                        {isCollapsed ? (
                            <motion.span
                                key="open"
                                initial={{ opacity: 0, rotate: -12, scale: 0.85 }}
                                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                                exit={{ opacity: 0, rotate: 12, scale: 0.85 }}
                                transition={{ duration: 0.16 }}
                                className="flex items-center justify-center"
                            >
                                <PanelLeftOpen className="size-4" />
                            </motion.span>
                        ) : (
                            <motion.span
                                key="close"
                                initial={{ opacity: 0, rotate: 12, scale: 0.85 }}
                                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                                exit={{ opacity: 0, rotate: -12, scale: 0.85 }}
                                transition={{ duration: 0.16 }}
                                className="flex items-center justify-center"
                            >
                                <PanelLeftClose className="size-4" />
                            </motion.span>
                        )}
                    </AnimatePresence>
                </motion.button>

                <div className="h-4 w-px bg-sidebar-border/60 hidden sm:block" />

                <div className="flex min-w-0 flex-1 items-center">
                    <Breadcrumbs breadcrumbs={breadcrumbs} />
                </div>
            </div>
        </header>
    );
}
