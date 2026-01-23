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
import { dashboard } from '@/routes';
import { Link } from '@inertiajs/react';
import { Banknote, BookOpen, ChevronRight, Folder, LayoutDashboard, LayoutGrid, Package, ShoppingBagIcon, Truck, WeightIcon, BookText, FileText } from 'lucide-react';
import AppLogo from './app-logo';
const mainNavItems = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
    },
];
const footerNavItems = [
    {
        title: 'Repository',
        href: 'https://github.com/laravel/react-starter-kit',
        icon: Folder,
    },
    {
        title: 'Documentation',
        href: 'https://laravel.com/docs/starter-kits#react',
        icon: BookOpen,
    },
];
const menuTextWrapClass = 'h-auto items-start [&>span:last-child]:whitespace-normal [&>span:last-child]:break-words [&>span:last-child]:text-clip [&>span:last-child]:overflow-visible';
const subMenuTextWrapClass = 'h-auto items-start [&>span:last-child]:whitespace-normal [&>span:last-child]:break-words [&>span:last-child]:text-clip [&>span:last-child]:overflow-visible';
const dropdownItemWrapClass = 'h-auto items-start whitespace-normal [&_span]:whitespace-normal [&_span]:break-words';
const menuSections = [
    {
        title: 'Marketing',
        icon: WeightIcon,
        items: [
            { title: 'Quotation', href: '/marketing/quotation' },
            { title: 'Purchase Requirement (PR)', href: '/marketing/purchase-requirement' },
            { title: 'Delivery Order (DO)', href: '/marketing/delivery-order' },
            { title: 'Delivery Order Add (DOA)', href: '/marketing/delivery-order-add' },
        ],
    },
    {
        title: 'Pembelian',
        icon: ShoppingBagIcon,
        items: [
            { title: 'Delivery Order Cost (APB)', href: '/pembelian/delivery-order-cost' },
            { title: 'Purchase Order', href: '/pembelian/purchase-order' },
            { title: 'Invoice Masuk', href: '#' },
            { title: 'Permintaan Dana Operaisonal', href: '#' },
            { title: 'Permintaan Dana Biaya', href: '#' },
            { title: 'Biaya Kirim Pembelian', href: '#' },
            { title: 'Biaya Kirim Penjualan', href: '#' },
            { title: 'Payment Cost', href: '#' },
        ],
    },
    {
        title: 'Inventory',
        icon: Package,
        items: [
            { title: 'Data Material', href: '#' },
            { title: 'Penerimaan Material', href: '#' },
            { title: 'Transfer Material', href: '#' },
        ],
    },
    {
        title: 'Penjualan',
        icon: Truck,
        items: [
            { title: 'Faktur Penjualan', href: '/penjualan/faktur-penjualan' },
            { title: 'Kwitansi', href: '/penjualan/faktur-penjualan/kwitansi' },
            { title: 'Tanda Terima Invoice', href: '#' },
        ],
    },
    {
        title: 'Keuangan',
        icon: Banknote,
        items: [
            { title: 'Mutasi Kas', href: '#' },
            { title: 'Input Pembelian', href: '#' },
            { title: 'Input Penjualan', href: '#' },
            { title: 'Penyesuaian', href: '#' },
            { title: 'Jurnal Lainnya', href: '#' },
        ],
    },
    {
        title: 'Master Data',
        icon: BookText,
        items: [
            { title: 'Vendor', href: '/master-data/vendor' },
            { title: 'Customer', href: '/master-data/customer' },
            { title: 'Material', href: '/master-data/material' },
            { title: 'Biaya Kirim Pembelian', href: '#' },
            { title: 'Biaya Kirim Penjualan', href: '#' },
            { title: 'Pembayaran Biaya', href: '#' },
            { title: 'Invoice Receipt (FI)', href: '#' },
            { title: 'Faktur Penjualan', href: '#' },
        ],
    },
    {
        title: 'Laporan',
        icon: FileText,
        items: [
            { title: 'Jurnal Umum', href: '#' },
            { title: 'Jurnal Penyesuaian', href: '#' },
            { title: 'Buku Besar', href: '#' },
            { title: 'Buku Kas', href: '#' },
            { title: 'Neraca Saldo', href: '#' },
            { title: 'Neraca Lajur', href: '#' },
            { title: 'Neraca Akhir', href: '#' },
            { title: 'Rugi Laba', href: '#' },
            { title: 'Perubahan Modal', href: '#' },
        ],
    },
];
export function AppSidebar() {
    const { state } = useSidebar();
    const isCollapsed = state === 'collapsed';
    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()}>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton asChild className={menuTextWrapClass}>
                                <Link
                                    href={dashboard()}

                                    className="flex items-start gap-2"
                                >
                                    <LayoutDashboard />
                                    <span>Dashboard</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>

                        {menuSections.map((section) => {
                            const SectionIcon = section.icon;
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
                                                {section.items.map((item) => (
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
                                                    {section.items.map((item) => (
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
