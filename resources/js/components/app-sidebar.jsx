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
import { ChevronRight, LayoutDashboard } from 'lucide-react';
import {
    footerNavItems,
    getMainItemKey,
    getSectionItemKey,
    mainMenuItems,
    menuSections,
} from '@/data/menu-sections';
import AppLogo from './app-logo';
const menuTextWrapClass = 'h-auto items-start [&>span:last-child]:whitespace-normal [&>span:last-child]:break-words [&>span:last-child]:text-clip [&>span:last-child]:overflow-visible';
const subMenuTextWrapClass = 'h-auto items-start [&>span:last-child]:whitespace-normal [&>span:last-child]:break-words [&>span:last-child]:text-clip [&>span:last-child]:overflow-visible';
const dropdownItemWrapClass = 'h-auto items-start whitespace-normal [&_span]:whitespace-normal [&_span]:break-words';
export function AppSidebar() {
    const { state } = useSidebar();
    const isCollapsed = state === 'collapsed';
    const { auth } = usePage().props;
    const menuAccess = auth?.user?.menu_access ?? null;
    const hasPrivileges = auth?.user?.has_privileges ?? false;
    const userLevel = auth?.user?.level;
    const isAdmin =
        typeof userLevel === 'string' && userLevel.toLowerCase() === 'admin';

    const isAllowed = (key) => {
        if (isAdmin) return true;
        if (!hasPrivileges) return false;
        return !!menuAccess?.[key];
    };
    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={mainMenuItems[0]?.href ?? '/dashboard'}>
                                <AppLogo />
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
                                        className={menuTextWrapClass}
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
                                            <span>{item.title}</span>
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
                                                <SidebarMenuButton className={`w-full ${menuTextWrapClass}`}>
                                                    <SectionIcon />
                                                    <span>{section.title}</span>
                                                </SidebarMenuButton>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent side="right" align="start" className="min-w-56">
                                                <DropdownMenuLabel>{section.title}</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                {allowedItems.map((item) => (
                                                    <DropdownMenuItem key={item.title} asChild className={dropdownItemWrapClass}>
                                                        <Link href={item.href}>
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
                                                <SidebarMenuButton className={`w-full ${menuTextWrapClass}`}>
                                                    <SectionIcon />
                                                    <span>{section.title}</span>
                                                    <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                                                </SidebarMenuButton>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                                <SidebarMenuSub>
                                                    {allowedItems.map((item) => (
                                                        <SidebarMenuSubItem key={item.title}>
                                                            <SidebarMenuSubButton asChild className={subMenuTextWrapClass}>
                                                                <Link href={item.href}>
                                                                    <span>{item.title}</span>
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
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
