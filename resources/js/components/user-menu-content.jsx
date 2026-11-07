import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';
import { useMobileNavigation } from '@/hooks/use-mobile-navigation';
import { Link, router, usePage } from '@inertiajs/react';
import { Building2, ChevronRight, LogOut, Settings, ShieldCheck, User } from 'lucide-react';

export function UserMenuContent({ user }) {
    const cleanup = useMobileNavigation();
    const getInitials = useInitials();
    const { tenant } = usePage().props;

    const name = user?.name ?? 'Pengguna';
    const email = user?.email ?? user?.username ?? '';
    const avatar = user?.avatar ?? '';
    const level = user?.level ?? 'User';
    const isAdmin = typeof level === 'string' && level.toLowerCase() === 'admin';
    const companyName = tenant?.company || tenant?.label || 'ISYSTEM Enterprise';

    const handleLogout = () => {
        cleanup();
        router.flushAll();
        router.post('/logout-simple', {}, {
            onFinish: () => {
                window.location.replace('/login');
            },
        });
    };

    return (
        <div className="w-full min-w-[260px] p-1 focus:outline-none">
            {/* ─── Profile Header Card ─── */}
            <DropdownMenuLabel className="p-0 font-normal">
                <div className="rounded-xl border border-sidebar-border/60 bg-gradient-to-br from-sidebar-accent/50 via-background to-sidebar-accent/20 p-2.5 shadow-xs space-y-2">
                    <div className="flex items-center gap-2.5">
                        <div className="relative shrink-0">
                            <Avatar className="size-9 rounded-xl border border-sidebar-border/70 shadow-xs">
                                <AvatarImage src={avatar} alt={name} />
                                <AvatarFallback className="rounded-xl bg-gradient-to-br from-indigo-500 to-teal-500 text-white font-bold text-xs">
                                    {getInitials(name)}
                                </AvatarFallback>
                            </Avatar>
                            <span className="absolute -bottom-0.5 -right-0.5 flex size-2.5">
                                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500 border-2 border-background" />
                            </span>
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1.5">
                                <span className="font-bold text-xs text-foreground truncate">{name}</span>
                                <span
                                    className={`px-1.5 py-0.2 rounded-md text-[9px] font-bold tracking-wider uppercase border shrink-0 ${
                                        isAdmin
                                            ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/25'
                                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
                                    }`}
                                >
                                    {level}
                                </span>
                            </div>
                            <span className="block text-[11px] text-muted-foreground truncate">
                                {email}
                            </span>
                        </div>
                    </div>

                    {/* Active Tenant / Company Info */}
                    <div className="pt-2 border-t border-sidebar-border/50 flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                        <Building2 className="size-3.5 text-indigo-500 shrink-0" />
                        <span className="truncate text-foreground/80 font-semibold text-[10.5px]">
                            {companyName}
                        </span>
                    </div>
                </div>
            </DropdownMenuLabel>

            {/* ─── Navigation Actions ─── */}
            <DropdownMenuGroup className="mt-2 space-y-1">
                <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
                    <Link
                        href="/settings"
                        as="button"
                        prefetch={false}
                        onClick={cleanup}
                        className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-foreground/90 hover:bg-sidebar-accent hover:text-foreground transition-all cursor-pointer focus:outline-none"
                    >
                        <div className="flex size-7 items-center justify-center rounded-lg bg-sidebar-accent text-muted-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-colors">
                            <Settings className="size-3.5" />
                        </div>
                        <div className="flex-1 text-left">
                            <div className="leading-tight">Pengaturan Akun</div>
                            <div className="text-[10px] font-normal text-muted-foreground">Profil & Preferensi</div>
                        </div>
                        <ChevronRight className="size-3.5 text-muted-foreground/50 group-hover:text-foreground transition-transform group-hover:translate-x-0.5" />
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator className="my-1.5 bg-sidebar-border/40" />

            {/* ─── Logout Button ─── */}
            <DropdownMenuItem
                onSelect={handleLogout}
                data-test="logout-button"
                className="group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 dark:hover:bg-rose-500/15 transition-all cursor-pointer focus:outline-none"
            >
                <div className="flex size-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:bg-rose-500/20 transition-colors">
                    <LogOut className="size-3.5" />
                </div>
                <div className="flex-1 text-left">
                    <div className="leading-tight">Keluar (Log out)</div>
                    <div className="text-[10px] font-normal text-rose-600/70 dark:text-rose-400/70">
                        Akhiri sesi login saat ini
                    </div>
                </div>
            </DropdownMenuItem>

            {/* ─── Footer Sesi ─── */}
            <div className="mt-1 px-2.5 py-1 text-[9.5px] text-muted-foreground/60 flex items-center justify-between border-t border-sidebar-border/30">
                <span>ISYSTEM Enterprise</span>
                <span className="font-mono">User: {user?.username || user?.kd_user || '-'}</span>
            </div>
        </div>
    );
}
