import { Breadcrumbs } from '@/components/breadcrumbs';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { usePage } from '@inertiajs/react';
export function AppSidebarHeader({ breadcrumbs = [], }) {
    return (<header className="flex h-14 md:h-16 shrink-0 items-center border-b border-sidebar-border/70 bg-background/95 backdrop-blur-sm px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:px-4">
            <div className="flex w-full items-center gap-2">
                <SidebarTrigger className="-ml-1"/>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Breadcrumbs breadcrumbs={breadcrumbs}/>
                </div>
            </div>
        </header>);
}
