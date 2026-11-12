import { NavFooter } from '@/components/nav-footer';
import { NavUser } from '@/components/nav-user';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import {
    footerNavItems,
    getMainItemKey,
    getSectionItemKey,
    mainMenuItems,
    menuSections,
} from '@/data/menu-sections';
import { Link, usePage } from '@inertiajs/react';
import {
    Activity,
    ChevronDown,
    ChevronRight,
    LayoutDashboard,
    PanelLeftClose,
    PanelLeftOpen,
    Search,
    Signal,
    Users,
    X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import AppLogo from './app-logo';

const sectionColorThemes = {
    Marketing: {
        accent: 'text-emerald-500 dark:text-emerald-400',
        bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
        border: 'border-emerald-500/20',
        indicator: 'bg-emerald-500',
    },
    Pembelian: {
        accent: 'text-sky-500 dark:text-sky-400',
        bg: 'bg-sky-500/10 dark:bg-sky-500/15',
        border: 'border-sky-500/20',
        indicator: 'bg-sky-500',
    },
    Pembayaran: {
        accent: 'text-amber-500 dark:text-amber-400',
        bg: 'bg-amber-500/10 dark:bg-amber-500/15',
        border: 'border-amber-500/20',
        indicator: 'bg-amber-500',
    },
    Inventory: {
        accent: 'text-cyan-500 dark:text-cyan-400',
        bg: 'bg-cyan-500/10 dark:bg-cyan-500/15',
        border: 'border-cyan-500/20',
        indicator: 'bg-cyan-500',
    },
    Penjualan: {
        accent: 'text-indigo-500 dark:text-indigo-400',
        bg: 'bg-indigo-500/10 dark:bg-indigo-500/15',
        border: 'border-indigo-500/20',
        indicator: 'bg-indigo-500',
    },
    Keuangan: {
        accent: 'text-purple-500 dark:text-purple-400',
        bg: 'bg-purple-500/10 dark:bg-purple-500/15',
        border: 'border-purple-500/20',
        indicator: 'bg-purple-500',
    },
    'Master Data': {
        accent: 'text-teal-500 dark:text-teal-400',
        bg: 'bg-teal-500/10 dark:bg-teal-500/15',
        border: 'border-teal-500/20',
        indicator: 'bg-teal-500',
    },
    Laporan: {
        accent: 'text-rose-500 dark:text-rose-400',
        bg: 'bg-rose-500/10 dark:bg-rose-500/15',
        border: 'border-rose-500/20',
        indicator: 'bg-rose-500',
    },
};

const defaultSectionTheme = {
    accent: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/20',
    indicator: 'bg-primary',
};

export function AppSidebar() {
    const { state, isMobile, setOpen, setOpenMobile, toggleSidebar } = useSidebar();
    const isCollapsed = state === 'collapsed';
    const page = usePage();
    const { auth, tenant } = page.props;
    const currentUrl = page.url || '';

    const menuAccess = auth?.user?.menu_access ?? null;
    const hasPrivileges = auth?.user?.has_privileges ?? false;
    const userLevel = auth?.user?.level;
    const isAdmin =
        typeof userLevel === 'string' && userLevel.toLowerCase() === 'admin';

    // Search query state
    const [searchQuery, setSearchQuery] = useState('');

    // Accordion state
    const [openSections, setOpenSections] = useState({});

    // Live ping state
    const [pingMs, setPingMs] = useState(null);
    const [pingLoading, setPingLoading] = useState(false);

    // Online users state
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [onlineOpen, setOnlineOpen] = useState(false);

    // Route active checker helper
    const isRouteActive = (href) => {
        if (!href) return false;
        const cleanCurrent = currentUrl.split('?')[0];
        const cleanHref = href.split('?')[0];
        return cleanCurrent === cleanHref || cleanCurrent.startsWith(cleanHref + '/');
    };

    // Auto-open sections on load when active item is detected
    useEffect(() => {
        setOpenSections((prev) => {
            const next = { ...prev };
            menuSections.forEach((section) => {
                const hasActive = section.items.some((item) => isRouteActive(item.href));
                if (hasActive) {
                    next[section.title] = true;
                }
            });
            return next;
        });
    }, [currentUrl]);

    // Polling ping
    useEffect(() => {
        const pingBackend = () => {
            setPingLoading(true);
            const start = performance.now();
            fetch('/ping', { headers: { Accept: 'application/json' } })
                .then(() => {
                    const ms = performance.now() - start;
                    setPingMs(ms);
                })
                .catch(() => setPingMs(null))
                .finally(() => setPingLoading(false));
        };
        pingBackend();
        const interval = setInterval(pingBackend, 5000);
        return () => clearInterval(interval);
    }, []);

    // Polling online users
    useEffect(() => {
        const fetchOnline = () => {
            fetch('/online-users', { headers: { Accept: 'application/json' } })
                .then((res) => res.json())
                .then((data) => {
                    setOnlineUsers(Array.isArray(data?.users) ? data.users : []);
                })
                .catch(() => setOnlineUsers([]));
        };
        fetchOnline();
        const timer = setInterval(fetchOnline, 5000);
        return () => clearInterval(timer);
    }, []);

    const isAllowed = (key) => {
        if (isAdmin) return true;
        if (!hasPrivileges) return false;
        const access = menuAccess?.[key];
        if (access && typeof access === 'object' && !Array.isArray(access)) {
            return !!access.view;
        }
        return !!access;
    };

    const toggleSection = (title) => {
        setOpenSections((prev) => ({
            ...prev,
            [title]: !prev[title],
        }));
    };

    // Connection severity indicator
    const connectionSeverity = (() => {
        if (pingMs === null) return 'unknown';
        if (pingMs > 400) return 'bad';
        if (pingMs >= 150) return 'warn';
        return 'good';
    })();

    const severityStyle = {
        unknown: {
            dot: 'bg-muted-foreground/60',
            badge: 'bg-muted/50 text-muted-foreground border-sidebar-border/50',
            pulse: 'bg-muted-foreground',
            label: 'Offline',
        },
        bad: {
            dot: 'bg-rose-500',
            badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
            pulse: 'bg-rose-400',
            label: `${pingMs?.toFixed(0)} ms • Lambat`,
        },
        warn: {
            dot: 'bg-amber-500',
            badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
            pulse: 'bg-amber-400',
            label: `${pingMs?.toFixed(0)} ms • Sedang`,
        },
        good: {
            dot: 'bg-emerald-500',
            badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
            pulse: 'bg-emerald-400',
            label: `${pingMs?.toFixed(0)} ms • Cepat`,
        },
    }[connectionSeverity];

    // Filtered menu calculation
    const query = searchQuery.trim().toLowerCase();

    const filteredMainMenu = useMemo(() => {
        return mainMenuItems
            .filter((item) => isAllowed(getMainItemKey(item.title)))
            .filter((item) => !query || item.title.toLowerCase().includes(query));
    }, [query, isAdmin, hasPrivileges, menuAccess]);

    const filteredSections = useMemo(() => {
        return menuSections
            .map((section) => {
                const allowedItems = section.items.filter((item) =>
                    isAllowed(getSectionItemKey(section.title, item.title))
                );

                const matchingItems = query
                    ? allowedItems.filter((item) =>
                          item.title.toLowerCase().includes(query) ||
                          section.title.toLowerCase().includes(query)
                      )
                    : allowedItems;

                return {
                    ...section,
                    items: matchingItems,
                    totalAllowed: allowedItems.length,
                };
            })
            .filter((section) => section.items.length > 0);
    }, [query, isAdmin, hasPrivileges, menuAccess]);

    const tenantLabel =
        tenant?.label || tenant?.database?.toString().replace(/^db\s*/i, '').toUpperCase() || '';

    return (
        <Sidebar collapsible="icon" variant="inset">
            {/* ─── Header: Brand Logo ────────────────── */}
            <SidebarHeader
                className={`relative z-10 border-b border-sidebar-border/40 transition-all duration-200 ${
                    isCollapsed ? 'p-2 flex items-center justify-center' : 'px-3 py-3'
                }`}
            >
                <div className={`flex items-center w-full ${isCollapsed ? 'justify-center' : 'gap-2'}`}>
                    <SidebarMenu className={`min-w-0 ${isCollapsed ? 'w-full flex items-center justify-center' : 'flex-1'}`}>
                        <SidebarMenuItem className={isCollapsed ? 'w-full flex justify-center' : ''}>
                            <Link
                                href={mainMenuItems[0]?.href ?? '/dashboard'}
                                className={`flex items-center rounded-xl transition-all duration-200 hover:bg-sidebar-accent/50 group ${
                                    isCollapsed ? 'size-9 p-0 justify-center' : 'p-1'
                                }`}
                            >
                                <AppLogo collapsed={isCollapsed} />
                            </Link>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </div>

                {/* Tenant / Database indicator pill */}
                {!isCollapsed && tenantLabel && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-1 flex items-center justify-between rounded-lg bg-sidebar-accent/40 px-2.5 py-1 text-[10px] text-muted-foreground border border-sidebar-border/40"
                    >
                        <span className="font-semibold tracking-wider text-foreground/80 truncate">
                            {tenantLabel}
                        </span>
                        <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                        </span>
                    </motion.div>
                )}

                {/* Search Quick Filter Bar (Expanded mode only) */}
                {!isCollapsed && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="relative mt-2"
                    >
                        <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground/70 pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Cari menu & modul..."
                            className="w-full rounded-xl bg-muted/40 hover:bg-muted/60 focus:bg-background pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 border border-sidebar-border/50 outline-hidden transition-all duration-200 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-2 size-4 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                            >
                                <X className="size-3" />
                            </button>
                        )}
                    </motion.div>
                )}
            </SidebarHeader>

            {/* ─── Content: Fluid Motion Navigation Menu ─────────────────────── */}
            <SidebarContent className="px-2 py-2 space-y-1 scrollbar-none">
                {/* Main Menu (Dashboard) */}
                <div className="space-y-1">
                    {filteredMainMenu.map((item) => {
                        const active = isRouteActive(item.href);
                        return (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton
                                    asChild
                                    tooltip={item.title}
                                    isActive={active}
                                    className={`relative rounded-xl transition-all duration-200 ${
                                        active
                                            ? 'bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent text-emerald-700 dark:text-emerald-300 font-semibold shadow-xs'
                                            : 'hover:bg-sidebar-accent/60 text-foreground/80'
                                    }`}
                                >
                                    <Link
                                        href={item.href}
                                        className="flex items-center gap-3 w-full"
                                    >
                                        <div
                                            className={`flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                                                active
                                                    ? 'bg-emerald-500 text-white border-emerald-400/40 shadow-xs shadow-emerald-500/30'
                                                    : 'bg-sidebar-accent/50 text-muted-foreground border-sidebar-border/50 group-hover:text-foreground'
                                            }`}
                                        >
                                            {item.icon ? (
                                                <item.icon className="size-4" />
                                            ) : (
                                                <LayoutDashboard className="size-4" />
                                            )}
                                        </div>
                                        <span className={isCollapsed ? 'sr-only' : 'text-xs truncate font-medium'}>
                                            {item.title}
                                        </span>
                                        {active && !isCollapsed && (
                                            <motion.span
                                                layoutId="active-nav-glow"
                                                className="ml-auto size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                                            />
                                        )}
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        );
                    })}
                </div>

                {/* Sections Divider Title */}
                {!isCollapsed && filteredSections.length > 0 && (
                    <div className="pt-2 pb-1 px-2.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 select-none">
                        <span>Modul Sistem</span>
                        {searchQuery && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-normal">
                                {filteredSections.reduce((acc, s) => acc + s.items.length, 0)} hasil
                            </span>
                        )}
                    </div>
                )}

                {/* Modules & Section Items */}
                <div className="space-y-1">
                    {filteredSections.map((section) => {
                        const SectionIcon = section.icon;
                        const theme = sectionColorThemes[section.title] || defaultSectionTheme;
                        const isOpen = openSections[section.title] || !!query;
                        const hasActiveSub = section.items.some((item) => isRouteActive(item.href));

                        // ── Collapsed Mode: Modern Flyout Popover ──
                        if (isCollapsed) {
                            return (
                                <SidebarMenuItem key={section.title}>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <SidebarMenuButton
                                                tooltip={section.title}
                                                className={`relative size-9 rounded-xl transition-all duration-200 justify-center ${
                                                    hasActiveSub
                                                        ? `${theme.bg} ${theme.accent} ring-1 ${theme.border} font-semibold shadow-xs`
                                                        : 'hover:bg-sidebar-accent/70 text-muted-foreground hover:text-foreground'
                                                }`}
                                            >
                                                <div className="flex items-center justify-center">
                                                    <SectionIcon className="size-4.5" />
                                                </div>
                                                {hasActiveSub && (
                                                    <span
                                                        className={`absolute -top-0.5 -right-0.5 size-2 rounded-full ${theme.indicator} ring-2 ring-background`}
                                                    />
                                                )}
                                            </SidebarMenuButton>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            side="right"
                                            align="start"
                                            className="min-w-60 rounded-2xl p-2 bg-popover/95 backdrop-blur-2xl border border-sidebar-border shadow-2xl space-y-1 z-50"
                                        >
                                            <DropdownMenuLabel className="flex items-center gap-2 px-2 py-1.5 text-xs font-bold">
                                                <div className={`p-1.5 rounded-lg ${theme.bg} ${theme.accent}`}>
                                                    <SectionIcon className="size-3.5" />
                                                </div>
                                                <span>{section.title}</span>
                                                <span className="ml-auto text-[10px] font-normal text-muted-foreground">
                                                    {section.items.length} menu
                                                </span>
                                            </DropdownMenuLabel>
                                            <DropdownMenuSeparator className="my-1 bg-sidebar-border/40" />
                                            <div className="max-h-80 overflow-y-auto space-y-0.5">
                                                {section.items.map((item) => {
                                                    const subActive = isRouteActive(item.href);
                                                    return (
                                                        <DropdownMenuItem
                                                            key={item.title}
                                                            asChild
                                                            className={`rounded-xl px-2.5 py-1.5 text-xs cursor-pointer transition-all ${
                                                                subActive
                                                                    ? `${theme.bg} ${theme.accent} font-semibold`
                                                                    : 'hover:bg-sidebar-accent/80'
                                                            }`}
                                                        >
                                                            <Link href={item.href} prefetch={false}>
                                                                <span className="truncate">{item.title}</span>
                                                                {subActive && (
                                                                    <span className={`ml-auto size-1.5 rounded-full ${theme.indicator}`} />
                                                                )}
                                                            </Link>
                                                        </DropdownMenuItem>
                                                    );
                                                })}
                                            </div>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </SidebarMenuItem>
                            );
                        }

                        // ── Expanded Mode: Motion Accordion with Stagger Effect ──
                        return (
                            <SidebarMenuItem key={section.title} className="overflow-hidden">
                                <motion.button
                                    type="button"
                                    onClick={() => toggleSection(section.title)}
                                    whileHover={{ x: 2 }}
                                    whileTap={{ scale: 0.99 }}
                                    className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium transition-all duration-200 outline-hidden ${
                                        hasActiveSub
                                            ? 'bg-sidebar-accent/50 text-foreground font-semibold'
                                            : 'text-foreground/80 hover:bg-sidebar-accent/40 hover:text-foreground'
                                    }`}
                                >
                                    <div
                                        className={`flex size-7 shrink-0 items-center justify-center rounded-lg border transition-all duration-200 ${
                                            hasActiveSub
                                                ? `${theme.bg} ${theme.accent} ${theme.border} shadow-xs`
                                                : `bg-muted/40 text-muted-foreground border-sidebar-border/50 group-hover:${theme.accent} group-hover:${theme.bg}`
                                        }`}
                                    >
                                        <SectionIcon className="size-3.5 transition-transform group-hover:scale-110" />
                                    </div>

                                    <span className="truncate text-xs font-medium">{section.title}</span>

                                    <div className="ml-auto flex items-center gap-1.5">
                                        <span className="rounded-full bg-muted/60 px-1.5 py-0.2 text-[9px] font-semibold text-muted-foreground">
                                            {section.items.length}
                                        </span>
                                        <motion.div
                                            animate={{ rotate: isOpen ? 90 : 0 }}
                                            transition={{ duration: 0.2, ease: 'easeOut' }}
                                        >
                                            <ChevronRight className="size-3.5 text-muted-foreground/60 transition-colors group-hover:text-foreground" />
                                        </motion.div>
                                    </div>
                                </motion.button>

                                <AnimatePresence initial={false}>
                                    {isOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{
                                                height: 'auto',
                                                opacity: 1,
                                                transition: {
                                                    height: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
                                                    opacity: { duration: 0.2 },
                                                },
                                            }}
                                            exit={{
                                                height: 0,
                                                opacity: 0,
                                                transition: {
                                                    height: { duration: 0.2, ease: 'easeInOut' },
                                                    opacity: { duration: 0.15 },
                                                },
                                            }}
                                            className="overflow-hidden"
                                        >
                                            <div className="ml-4 pl-3.5 py-1 my-1 border-l-2 border-sidebar-border/50 space-y-0.5">
                                                {section.items.map((item) => {
                                                    const isSubActive = isRouteActive(item.href);
                                                    return (
                                                        <motion.div
                                                            key={item.title}
                                                            whileHover={{ x: 3 }}
                                                            whileTap={{ scale: 0.98 }}
                                                            transition={{ duration: 0.15 }}
                                                        >
                                                            <Link
                                                                href={item.href}
                                                                prefetch={false}
                                                                className={`group/sub flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-all duration-150 ${
                                                                    isSubActive
                                                                        ? `${theme.bg} ${theme.accent} font-semibold shadow-2xs`
                                                                        : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground'
                                                                }`}
                                                            >
                                                                <span className="truncate leading-snug">
                                                                    {item.title}
                                                                </span>
                                                                {isSubActive && (
                                                                    <span
                                                                        className={`size-1.5 shrink-0 rounded-full ${theme.indicator} shadow-xs`}
                                                                    />
                                                                )}
                                                            </Link>
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </SidebarMenuItem>
                        );
                    })}

                    {/* Empty Search State */}
                    {filteredSections.length === 0 && filteredMainMenu.length === 0 && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="py-8 text-center"
                        >
                            <p className="text-xs text-muted-foreground">Tidak ada menu yang sesuai</p>
                            <Button
                                variant="link"
                                size="sm"
                                onClick={() => setSearchQuery('')}
                                className="text-xs text-emerald-600 dark:text-emerald-400 mt-1"
                            >
                                Reset pencarian
                            </Button>
                        </motion.div>
                    )}
                </div>
            </SidebarContent>

            {/* ─── Footer: Unified System Health HUD & User Profile ───────────── */}
            <SidebarFooter className="relative z-10 px-2.5 py-2.5 border-t border-sidebar-border/40 space-y-2">
                {!isCollapsed ? (
                    <>
                        {/* System Status & HUD Card */}
                        <div className="rounded-xl border border-sidebar-border/60 bg-gradient-to-br from-sidebar-accent/40 via-background to-sidebar-accent/20 p-2 shadow-xs space-y-1.5">
                            {/* Connection Ping Row */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-[11px]">
                                    <Activity className="size-3.5 text-muted-foreground" />
                                    <span className="font-semibold text-foreground/80">Koneksi Server</span>
                                </div>
                                <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${severityStyle.badge}`}
                                >
                                    {pingLoading && pingMs === null ? 'Mengukur...' : severityStyle.label}
                                </span>
                            </div>

                            {/* Active Collaborators Toggle */}
                            <motion.button
                                type="button"
                                onClick={() => setOnlineOpen((prev) => !prev)}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                className="flex w-full items-center justify-between rounded-lg bg-muted/40 hover:bg-muted/70 px-2 py-1 text-[11px] text-foreground/80 transition-colors"
                            >
                                <div className="flex items-center gap-1.5 font-medium">
                                    <Users className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <span>User Online</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                        {onlineUsers.length}
                                    </span>
                                    <motion.div
                                        animate={{ rotate: onlineOpen ? 180 : 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <ChevronDown className="size-3 text-muted-foreground" />
                                    </motion.div>
                                </div>
                            </motion.button>

                            {/* Collapsible Active User Drawer */}
                            <AnimatePresence>
                                {onlineOpen && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden pt-1"
                                    >
                                        <div className="max-h-28 overflow-y-auto space-y-1 rounded-lg bg-background/80 p-1.5 border border-sidebar-border/40 scrollbar-thin">
                                            {onlineUsers.length === 0 ? (
                                                <p className="text-[10px] text-muted-foreground text-center py-1">
                                                    Tidak ada user lain online
                                                </p>
                                            ) : (
                                                onlineUsers.map((user, idx) => {
                                                    const initial = (user || '?').charAt(0).toUpperCase();
                                                    return (
                                                        <div
                                                            key={`${user}-${idx}`}
                                                            className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[11px] bg-muted/30"
                                                        >
                                                            <span className="flex size-4.5 items-center justify-center rounded-full bg-emerald-500/20 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                                                                {initial}
                                                            </span>
                                                            <span className="truncate text-foreground/80 font-medium">
                                                                {user}
                                                            </span>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </>
                ) : (
                    /* Collapsed Footer: Compact Ping & Online Indicator Pills */
                    <div className="flex flex-col items-center gap-2 py-1">
                        <div
                            title={`Status server: ${severityStyle.label}`}
                            className={`flex size-8 items-center justify-center rounded-xl border ${severityStyle.badge} transition-transform hover:scale-105`}
                        >
                            <Activity className="size-3.5" />
                        </div>
                    </div>
                )}

                {/* Footer Navigation (if configured) */}
                {footerNavItems.length > 0 && (
                    <NavFooter items={footerNavItems} className="mt-auto" />
                )}

                {/* User Profile Bar */}
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
