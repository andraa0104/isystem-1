import AppLogoIcon from './app-logo-icon';
import { motion } from 'motion/react';

export default function AppLogo({ collapsed = false }) {
    return (
        <div
            className={`flex items-center select-none ${
                collapsed ? 'justify-center w-full' : 'gap-3'
            }`}
        >
            <motion.div
                className={`relative flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/15 via-cyan-500/10 to-transparent ring-1 ring-emerald-500/25 shadow-xs ${
                    collapsed ? 'size-9 p-1' : 'size-10 p-1.5'
                }`}
                whileHover={{ scale: 1.08, rotate: 6 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 350, damping: 20 }}
            >
                <AppLogoIcon className="size-full" />
                <span
                    className={`absolute flex ${
                        collapsed ? 'top-0 right-0 size-2' : '-top-0.5 -right-0.5 size-2.5'
                    }`}
                >
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-full rounded-full bg-emerald-500 ring-2 ring-background" />
                </span>
            </motion.div>

            {!collapsed && (
                <div className="grid flex-1 text-left leading-none">
                    <div className="flex items-center gap-1.5">
                        <span className="truncate text-base font-bold tracking-tight bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400 bg-clip-text text-transparent">
                            i-System
                        </span>
                        <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 uppercase">
                            Enterprise
                        </span>
                    </div>
                    <span className="mt-1 truncate text-[10px] text-muted-foreground font-medium tracking-wide">
                        Core Management Suite
                    </span>
                </div>
            )}
        </div>
    );
}
