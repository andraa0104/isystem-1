import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';
import { UserMenuContent } from '@/components/user-menu-content';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePage } from '@inertiajs/react';
import { ChevronsUpDown } from 'lucide-react';

export function NavUser() {
    const { auth, tenant } = usePage().props;
    const { state } = useSidebar();
    const isMobile = useIsMobile();
    const getInitials = useInitials();
    const isCollapsed = state === 'collapsed';

    const user = auth?.user;
    const name = user?.name ?? 'Pengguna';
    const avatar = user?.avatar ?? '';
    const level = user?.level ?? 'User';

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className={`group relative rounded-xl border border-sidebar-border/50 bg-gradient-to-r from-sidebar-accent/40 via-background to-sidebar-accent/20 hover:from-sidebar-accent/70 hover:to-sidebar-accent/40 hover:border-sidebar-border/80 transition-all duration-200 text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:border-primary/40 shadow-xs cursor-pointer ${
                                isCollapsed ? 'justify-center p-1.5' : 'p-2'
                            }`}
                            data-test="sidebar-menu-button"
                        >
                            {/* Avatar with Online Glow Dot */}
                            <div className="relative shrink-0">
                                <Avatar className="size-8 rounded-lg border border-sidebar-border/60 shadow-xs">
                                    <AvatarImage src={avatar} alt={name} />
                                    <AvatarFallback className="rounded-lg bg-gradient-to-br from-indigo-500 to-teal-500 text-white font-bold text-xs">
                                        {getInitials(name)}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="absolute -bottom-0.5 -right-0.5 flex size-2">
                                    <span className="relative inline-flex size-2 rounded-full bg-emerald-500 ring-1 ring-background" />
                                </span>
                            </div>

                            {/* User details (when expanded) */}
                            {!isCollapsed && (
                                <>
                                    <div className="grid flex-1 text-left leading-tight ml-1.5 min-w-0">
                                        <span className="truncate font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                                            {name}
                                        </span>
                                        <span className="truncate text-[10.5px] text-muted-foreground flex items-center gap-1 font-medium">
                                            <span className="uppercase text-[9px] font-bold text-indigo-600 dark:text-indigo-400">
                                                {level}
                                            </span>
                                            <span>•</span>
                                            <span className="truncate">
                                                {user?.username || tenant?.label || 'Online'}
                                            </span>
                                        </span>
                                    </div>
                                    <ChevronsUpDown className="ml-auto size-3.5 text-muted-foreground/60 transition-transform duration-200 group-hover:text-foreground group-data-[state=open]:rotate-180" />
                                </>
                            )}
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                        className="rounded-2xl border border-sidebar-border/70 bg-card/95 backdrop-blur-xl shadow-2xl p-1.5 focus:outline-none"
                        align={isCollapsed ? 'start' : 'center'}
                        side={isMobile ? 'bottom' : isCollapsed ? 'right' : 'top'}
                        sideOffset={10}
                    >
                        <UserMenuContent user={user} />
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
