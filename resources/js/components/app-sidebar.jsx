import { NavFooter } from '@/components/nav-footer';
import { NavUser } from '@/components/nav-user';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { Link, usePage } from '@inertiajs/react';
import { ChevronRight, LayoutDashboard, Signal } from 'lucide-react';
import {
    footerNavItems,
    getMainItemKey,
    getSectionItemKey,
    mainMenuItems,
    menuSections,
} from '@/data/menu-sections';
import { useEffect, useState } from 'react';
import { Spinner } from './ui/spinner';
import AppLogo from './app-logo';
const expandedTextWrapClass =
    'h-auto items-start [&>span:last-child]:whitespace-normal [&>span:last-child]:break-words [&>span:last-child]:text-clip';
const dropdownItemWrapClass =
    'h-auto items-start whitespace-normal [&_span]:whitespace-normal [&_span]:break-words';
export function AppSidebar() {
    const { state } = useSidebar();
    const isCollapsed = state === 'collapsed';
    const { auth } = usePage().props;
    const menuAccess = auth?.user?.menu_access ?? null;
    const hasPrivileges = auth?.user?.has_privileges ?? false;
    const userLevel = auth?.user?.level;
    const isAdmin =
        typeof userLevel === 'string' && userLevel.toLowerCase() === 'admin';

    const [onlineUsers, setOnlineUsers] = useState([]);
    const [onlineLoading, setOnlineLoading] = useState(false);
    const [onlineOpen, setOnlineOpen] = useState(false);
    const [pingMs, setPingMs] = useState(null);
    const [pingLoading, setPingLoading] = useState(false);
    const [netInfo, setNetInfo] = useState({
        type: 'unknown',
        downlink: null,
        rtt: null,
        effectiveType: 'unknown',
        online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    });

    useEffect(() => {
        const updateNetInfo = () => {
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            setNetInfo({
                type: connection?.type ?? 'unknown',
                downlink: connection?.downlink ?? null,
                rtt: connection?.rtt ?? null,
                effectiveType: connection?.effectiveType ?? 'unknown',
                online: navigator.onLine,
            });
        };
        updateNetInfo();
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        connection?.addEventListener('change', updateNetInfo);
        window.addEventListener('online', updateNetInfo);
        window.addEventListener('offline', updateNetInfo);
        const interval = setInterval(updateNetInfo, 5000);
        return () => {
            connection?.removeEventListener('change', updateNetInfo);
            window.removeEventListener('online', updateNetInfo);
            window.removeEventListener('offline', updateNetInfo);
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        let timer;
        const fetchOnline = () => {
            setOnlineLoading(true);
            fetch('/online-users', { headers: { Accept: 'application/json' } })
                .then((res) => res.json())
                .then((data) => {
                    setOnlineUsers(Array.isArray(data?.users) ? data.users : []);
                })
                .catch(() => {
                    setOnlineUsers([]);
                })
                .finally(() => setOnlineLoading(false));
        };
        fetchOnline();
        timer = setInterval(fetchOnline, 5000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const pingDb = () => {
            setPingLoading(true);
            fetch('/ping-db', { headers: { Accept: 'application/json' } })
                .then((res) => res.json())
                .then((data) => setPingMs(typeof data?.ping_ms === 'number' ? data.ping_ms : null))
                .catch(() => setPingMs(null))
                .finally(() => setPingLoading(false));
        };
        pingDb();
        const interval = setInterval(pingDb, 5000);
        return () => clearInterval(interval);
    }, []);

    const connectionSeverity = (() => {
        if (!netInfo.online) return 'down';
        if (pingMs !== null) {
            if (pingMs > 400) return 'bad';
            if (pingMs >= 150) return 'warn';
            return 'good';
        }
        if (netInfo.effectiveType === 'slow-2g' || netInfo.effectiveType === '2g')
            return 'warn';
        if (netInfo.effectiveType === '3g') return 'warn';
        // default dianggap baik
        return 'good';
    })();

    const severityTone = {
        down: {
            chip: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
            bar: 'bg-rose-500',
        },
        bad: {
            chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
            bar: 'bg-amber-500',
        },
        warn: {
            chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
            bar: 'bg-amber-500',
        },
        good: {
            chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
            bar: 'bg-emerald-500',
        },
    }[connectionSeverity] || { chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300', bar: 'bg-emerald-500' };

    const pingLabel =
        pingLoading
            ? 'Mengukur koneksi...'
            : pingMs === null
              ? netInfo.online
                    ? 'Tidak ada data ping'
                    : 'Offline'
              : pingMs > 400
                ? `Lambat ${pingMs.toFixed(0)} ms`
                : pingMs >= 150
                  ? `Sedang ${pingMs.toFixed(0)} ms`
                  : `Cepat ${pingMs.toFixed(0)} ms`;

    const pingLabelShort =
        pingLoading
            ? '...'
            : pingMs === null
              ? netInfo.online
                    ? 'N/A'
                    : 'Off'
              : `${pingMs.toFixed(0)}ms`;

    const isAllowed = (key) => {
        if (isAdmin) return true;
        if (!hasPrivileges) return false;
        return !!menuAccess?.[key];
    };

    const menuTextWrapClass = isCollapsed ? '' : expandedTextWrapClass;
    const subMenuTextWrapClass = isCollapsed ? '' : expandedTextWrapClass;

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={mainMenuItems[0]?.href ?? '/dashboard'}>
                                <AppLogo collapsed={isCollapsed} />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarMenu>
                        {mainMenuItems
                            .filter((item) => isAllowed(getMainItemKey(item.title)))
                            .map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        asChild
                                        tooltip={item.title}
                                        className={`${menuTextWrapClass} ${isCollapsed ? 'justify-center' : ''}`}
                                    >
                                        <Link
                                            href={item.href}
                                            className="flex items-start gap-2"
                                        >
                                            {item.icon ? (
                                                <item.icon />
                                            ) : (
                                                <LayoutDashboard />
                                            )}
                                            <span className={isCollapsed ? 'sr-only' : ''}>
                                                {item.title}
                                            </span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}

                        {menuSections.map((section) => {
                            const SectionIcon = section.icon;
                            const allowedItems = section.items.filter((item) =>
                                isAllowed(
                                    getSectionItemKey(section.title, item.title)
                                )
                            );
                            if (allowedItems.length === 0) {
                                return null;
                            }
                            return (
                                isCollapsed ? (
                                    <SidebarMenuItem key={section.title}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <SidebarMenuButton
                                                    tooltip={section.title}
                                                    className={`w-full ${menuTextWrapClass} ${isCollapsed ? 'justify-center' : ''}`}
                                                >
                                                    <SectionIcon />
                                                    <span className={isCollapsed ? 'sr-only' : ''}>
                                                        {section.title}
                                                    </span>
                                                </SidebarMenuButton>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent side="right" align="start" className="min-w-56">
                                                <DropdownMenuLabel>{section.title}</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                {allowedItems.map((item) => (
                                                    <DropdownMenuItem key={item.title} asChild className={dropdownItemWrapClass}>
                                                        <Link
                                                            href={item.href}
                                                            prefetch={false}
                                                        >
                                                            <span>{item.title}</span>
                                                        </Link>
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </SidebarMenuItem>
                                ) : (
                                    <Collapsible key={section.title} className="group/collapsible">
                                        <SidebarMenuItem>
                                            <CollapsibleTrigger asChild>
                                                <SidebarMenuButton
                                                    tooltip={section.title}
                                                    className={`w-full ${menuTextWrapClass} ${isCollapsed ? 'justify-center' : ''}`}
                                                >
                                                    <SectionIcon />
                                                    <span className={isCollapsed ? 'sr-only' : ''}>
                                                        {section.title}
                                                    </span>
                                                    <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                                                </SidebarMenuButton>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                                <SidebarMenuSub>
                                                    {allowedItems.map((item) => (
                                                        <SidebarMenuSubItem key={item.title}>
                                                            <SidebarMenuSubButton asChild className={subMenuTextWrapClass}>
                                                                <Link
                                                                    href={item.href}
                                                                    prefetch={false}
                                                                >
                                                                    <span className={isCollapsed ? 'sr-only' : ''}>
                                                                        {item.title}
                                                                    </span>
                                                                </Link>
                                                            </SidebarMenuSubButton>
                                                        </SidebarMenuSubItem>
                                                    ))}
                                                </SidebarMenuSub>
                                            </CollapsibleContent>
                                        </SidebarMenuItem>
                                    </Collapsible>
                                )
                            );
                        })}

                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter>
                {!isCollapsed && (
                    <>
	                        <SidebarMenu className="mb-3">
	                            <SidebarMenuItem>
	                                <SidebarMenuButton className={`w-full rounded-lg border border-sidebar-border/70 bg-gradient-to-r from-background via-muted to-background shadow-sm ${menuTextWrapClass}`}>
	                                    <div className="flex items-center gap-3">
	                                        <div
	                                            className={`relative flex h-9 w-9 items-center justify-center rounded-lg ${severityTone.chip}`}
	                                        >
	                                            <Signal className="h-4 w-4" />
	                                        </div>
	                                        <div className="flex flex-col leading-tight">
	                                            <span className="text-sm font-semibold">Koneksi</span>
	                                            <span className="text-[11px] text-muted-foreground">
	                                                {netInfo.online ? 'Online' : 'Offline'}
	                                            </span>
	                                        </div>
	                                    </div>
	                                    <div className="ml-auto flex items-center gap-2 text-xs font-semibold">
	                                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
	                                            <span className={`h-2 w-2 rounded-full ${severityTone.bar}`} />
	                                            <span className="hidden md:inline">{pingLabel}</span>
	                                            <span className="md:hidden">{pingLabelShort}</span>
	                                        </div>
	                                    </div>
	                                </SidebarMenuButton>
	                            </SidebarMenuItem>
	                        </SidebarMenu>

                        <Collapsible
                            className="group/collapsible mb-3"
                            open={onlineOpen}
                            onOpenChange={setOnlineOpen}
                        >
                            <SidebarMenu>
                                <SidebarMenuItem>
                                    <CollapsibleTrigger asChild>
                                        <SidebarMenuButton
                                            className={`w-full rounded-lg border border-sidebar-border/70 bg-gradient-to-r from-muted to-background shadow-sm ${menuTextWrapClass}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="relative flex h-2.5 w-2.5">
                                                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                                                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                                </span>
                                                <div className="flex flex-col leading-tight">
                                                    <span className="text-sm font-semibold">User online</span>
                                                </div>
                                            </div>
                                            <span className="ml-auto flex items-center gap-2 text-xs font-semibold">
                                                <span className="inline-flex min-w-[28px] items-center justify-center rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-300">
                                                    {onlineUsers.length}
                                                </span>
                                                <ChevronRight className="transition-transform group-data-[state=open]/collapsible:rotate-90" />
                                            </span>
                                        </SidebarMenuButton>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <SidebarMenuSub>
                                            {onlineUsers.length === 0 ? (
                                                <SidebarMenuSubItem>
                                                    <SidebarMenuSubButton className={subMenuTextWrapClass}>
                                                        <span>Tidak ada user online.</span>
                                                    </SidebarMenuSubButton>
                                                </SidebarMenuSubItem>
                                            ) : (
                                                onlineUsers.map((name, idx) => {
                                                    const initial = (name || '?').charAt(0).toUpperCase();
                                                    return (
                                                        <SidebarMenuSubItem key={`${name}-${idx}`}>
                                                            <SidebarMenuSubButton className={`${subMenuTextWrapClass} bg-muted/40`}>
                                                                <span className="flex items-center gap-2">
                                                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                                                        {initial}
                                                                    </span>
                                                                    <span className="text-sm">{name || '-'}</span>
                                                                </span>
                                                            </SidebarMenuSubButton>
                                                        </SidebarMenuSubItem>
                                                    );
                                                })
                                            )}
                                        </SidebarMenuSub>
                                    </CollapsibleContent>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </Collapsible>
                    </>
                )}

                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
