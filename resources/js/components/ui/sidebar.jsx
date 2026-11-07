import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = "17rem";
const SIDEBAR_WIDTH_MOBILE = "18.5rem";
const SIDEBAR_WIDTH_ICON = "3.5rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

const SidebarContext = React.createContext(null);

function useSidebar() {
    const context = React.useContext(SidebarContext);
    if (!context) {
        throw new Error("useSidebar must be used within a SidebarProvider.");
    }
    return context;
}

function SidebarProvider({
    defaultOpen = true,
    open: openProp,
    onOpenChange: setOpenProp,
    className,
    style,
    children,
    ...props
}) {
    const isMobile = useIsMobile();
    const [openMobile, setOpenMobile] = React.useState(false);
    const [_open, _setOpen] = React.useState(defaultOpen);
    const open = openProp !== null && openProp !== void 0 ? openProp : _open;

    const setOpen = React.useCallback(
        (value) => {
            const openState = typeof value === "function" ? value(open) : value;
            if (setOpenProp) {
                setOpenProp(openState);
            } else {
                _setOpen(openState);
            }
            document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
        },
        [setOpenProp, open]
    );

    const toggleSidebar = React.useCallback(() => {
        return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open);
    }, [isMobile, setOpen, setOpenMobile]);

    React.useEffect(() => {
        const handleKeyDown = (event) => {
            if (
                event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
                (event.metaKey || event.ctrlKey)
            ) {
                event.preventDefault();
                toggleSidebar();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [toggleSidebar]);

    const state = open ? "expanded" : "collapsed";

    const contextValue = React.useMemo(
        () => ({
            state,
            open,
            setOpen,
            isMobile,
            openMobile,
            setOpenMobile,
            toggleSidebar,
        }),
        [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
    );

    return (
        <SidebarContext.Provider value={contextValue}>
            <TooltipProvider delayDuration={0}>
                <div
                    data-slot="sidebar-wrapper"
                    style={{
                        "--sidebar-width": SIDEBAR_WIDTH,
                        "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
                        ...style,
                    }}
                    className={cn(
                        "group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar/40 flex min-h-svh w-full",
                        className
                    )}
                    {...props}
                >
                    {children}
                </div>
            </TooltipProvider>
        </SidebarContext.Provider>
    );
}

function Sidebar({
    side = "left",
    variant = "sidebar",
    collapsible = "offcanvas",
    className,
    children,
    ...props
}) {
    const { isMobile, state, openMobile, setOpenMobile } = useSidebar();
    const isIconCollapsed = state === "collapsed" && collapsible === "icon";
    const iconWidthGap =
        variant === "floating" || variant === "inset"
            ? "calc(var(--sidebar-width-icon) + 1rem)"
            : "var(--sidebar-width-icon)";
    const iconWidthPanel =
        variant === "floating" || variant === "inset"
            ? "calc(var(--sidebar-width-icon) + 1rem + 2px)"
            : "var(--sidebar-width-icon)";

    if (collapsible === "none") {
        return (
            <div
                data-slot="sidebar"
                className={cn(
                    "bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col border-r border-sidebar-border/60",
                    className
                )}
                {...props}
            >
                {children}
            </div>
        );
    }

    if (isMobile) {
        return (
            <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
                <SheetContent
                    data-sidebar="sidebar"
                    data-slot="sidebar"
                    data-mobile="true"
                    className="bg-sidebar/95 backdrop-blur-2xl text-sidebar-foreground w-(--sidebar-width) p-0 [&>button]:hidden border-r border-sidebar-border/70"
                    style={{
                        "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
                    }}
                    side={side}
                >
                    <SheetHeader className="sr-only">
                        <SheetTitle>Sidebar</SheetTitle>
                        <SheetDescription>Displays the mobile navigation sidebar.</SheetDescription>
                    </SheetHeader>
                    <div className="flex h-full w-full flex-col">{children}</div>
                </SheetContent>
            </Sheet>
        );
    }

    return (
        <div
            className="group peer text-sidebar-foreground block"
            data-state={state}
            data-collapsible={state === "collapsed" ? collapsible : ""}
            data-variant={variant}
            data-side={side}
            data-slot="sidebar"
        >
            {/* Desktop gap handler */}
            <div
                style={isIconCollapsed ? { width: iconWidthGap } : undefined}
                className={cn(
                    "relative h-svh w-(--sidebar-width) bg-transparent transition-[width] duration-300 ease-out",
                    "group-data-[collapsible=offcanvas]:w-0",
                    "group-data-[side=right]:rotate-180",
                    variant === "floating" || variant === "inset"
                        ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+1rem)]"
                        : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
                )}
            />
            {/* Fixed sidebar container */}
            <div
                style={isIconCollapsed ? { width: iconWidthPanel } : undefined}
                className={cn(
                    "fixed inset-y-0 z-20 flex h-svh w-(--sidebar-width) transition-[left,right,width] duration-300 ease-out",
                    side === "left"
                        ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
                        : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
                    variant === "floating" || variant === "inset"
                        ? "p-2.5 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+1rem+2px)]"
                        : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l border-sidebar-border/70",
                    className
                )}
                {...props}
            >
                <div
                    data-sidebar="sidebar"
                    className="relative bg-sidebar/95 dark:bg-sidebar/90 backdrop-blur-2xl flex h-full w-full flex-col overflow-hidden rounded-2xl border border-sidebar-border/75 shadow-xl shadow-black/[0.04] dark:shadow-black/40 ring-1 ring-white/10 dark:ring-white/5"
                >
                    {/* Top ambient aurora glow accent */}
                    <div
                        className="pointer-events-none absolute -top-12 -left-12 size-48 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 blur-3xl"
                        aria-hidden="true"
                    />
                    <div
                        className="pointer-events-none absolute top-1/3 -right-12 size-40 rounded-full bg-cyan-500/10 dark:bg-cyan-500/10 blur-3xl"
                        aria-hidden="true"
                    />

                    {children}
                </div>
            </div>
        </div>
    );
}

function SidebarTrigger({ className, onClick, ...props }) {
    const { toggleSidebar, isMobile, state } = useSidebar();
    return (
        <Button
            data-sidebar="trigger"
            data-slot="sidebar-trigger"
            variant="ghost"
            size="icon"
            className={cn(
                "h-8 w-8 rounded-lg hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground transition-all duration-200 active:scale-95",
                className
            )}
            onClick={(event) => {
                onClick?.(event);
                toggleSidebar();
            }}
            {...props}
        >
            {isMobile || state === "collapsed" ? (
                <PanelLeftOpenIcon className="size-4.5 transition-transform duration-200" />
            ) : (
                <PanelLeftCloseIcon className="size-4.5 transition-transform duration-200" />
            )}
            <span className="sr-only">Toggle Sidebar</span>
        </Button>
    );
}

function SidebarRail({ className, ...props }) {
    const { toggleSidebar } = useSidebar();
    return (
        <button
            data-sidebar="rail"
            data-slot="sidebar-rail"
            aria-label="Toggle Sidebar"
            tabIndex={-1}
            onClick={toggleSidebar}
            title="Toggle Sidebar"
            className={cn(
                "hover:after:bg-sidebar-border/80 absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] sm:flex",
                "in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
                "[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
                "hover:group-data-[collapsible=offcanvas]:bg-sidebar group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full",
                className
            )}
            {...props}
        />
    );
}

function SidebarInset({ className, ...props }) {
    return (
        <main
            data-slot="sidebar-inset"
            className={cn(
                "bg-background relative flex max-w-full min-h-svh flex-1 flex-col transition-all duration-300",
                "peer-data-[variant=inset]:min-h-[calc(100svh-1rem)] md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-2xl md:peer-data-[variant=inset]:border md:peer-data-[variant=inset]:border-sidebar-border/60 md:peer-data-[variant=inset]:shadow-xs md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-0",
                className
            )}
            {...props}
        />
    );
}

function SidebarInput({ className, ...props }) {
    return (
        <Input
            data-slot="sidebar-input"
            data-sidebar="input"
            className={cn(
                "bg-muted/40 hover:bg-muted/60 focus:bg-background h-8 w-full rounded-lg border-sidebar-border/60 shadow-none text-xs transition-colors",
                className
            )}
            {...props}
        />
    );
}

function SidebarHeader({ className, ...props }) {
    return (
        <div
            data-slot="sidebar-header"
            data-sidebar="header"
            className={cn(
                "flex flex-col gap-2 p-3 border-b border-sidebar-border/40 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center",
                className
            )}
            {...props}
        />
    );
}

function SidebarFooter({ className, ...props }) {
    return (
        <div
            data-slot="sidebar-footer"
            data-sidebar="footer"
            className={cn("flex flex-col gap-2 p-3 border-t border-sidebar-border/40 mt-auto", className)}
            {...props}
        />
    );
}

function SidebarSeparator({ className, ...props }) {
    return (
        <Separator
            data-slot="sidebar-separator"
            data-sidebar="separator"
            className={cn("bg-sidebar-border/50 mx-2 w-auto", className)}
            {...props}
        />
    );
}

function SidebarContent({ className, ...props }) {
    return (
        <div
            data-slot="sidebar-content"
            data-sidebar="content"
            className={cn(
                "flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overflow-x-hidden p-2 group-data-[collapsible=icon]:overflow-hidden scrollbar-thin scrollbar-thumb-muted-foreground/20",
                className
            )}
            {...props}
        />
    );
}

function SidebarGroup({ className, ...props }) {
    return (
        <div
            data-slot="sidebar-group"
            data-sidebar="group"
            className={cn("relative flex w-full min-w-0 flex-col py-1", className)}
            {...props}
        />
    );
}

function SidebarGroupLabel({ className, asChild = false, ...props }) {
    const Comp = asChild ? Slot : "div";
    return (
        <Comp
            data-slot="sidebar-group-label"
            data-sidebar="group-label"
            className={cn(
                "text-sidebar-foreground/60 flex h-7 shrink-0 items-center rounded-md px-2.5 text-[10px] font-bold uppercase tracking-wider outline-hidden transition-[margin,opacity] duration-200 ease-linear [&>svg]:size-3.5 [&>svg]:shrink-0",
                "group-data-[collapsible=icon]:-mt-7 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:select-none group-data-[collapsible=icon]:pointer-events-none",
                className
            )}
            {...props}
        />
    );
}

function SidebarGroupAction({ className, asChild = false, ...props }) {
    const Comp = asChild ? Slot : "button";
    return (
        <Comp
            data-slot="sidebar-group-action"
            data-sidebar="group-action"
            className={cn(
                "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-3.5 [&>svg]:shrink-0",
                "group-data-[collapsible=icon]:hidden",
                className
            )}
            {...props}
        />
    );
}

function SidebarGroupContent({ className, ...props }) {
    return (
        <div
            data-slot="sidebar-group-content"
            data-sidebar="group-content"
            className={cn("w-full text-sm", className)}
            {...props}
        />
    );
}

function SidebarMenu({ className, ...props }) {
    return (
        <ul
            data-slot="sidebar-menu"
            data-sidebar="menu"
            className={cn("flex w-full min-w-0 flex-col gap-1", className)}
            {...props}
        />
    );
}

function SidebarMenuItem({ className, ...props }) {
    return (
        <li
            data-slot="sidebar-menu-item"
            data-sidebar="menu-item"
            className={cn("group/menu-item relative list-none", className)}
            {...props}
        />
    );
}

const sidebarMenuButtonVariants = cva(
    "peer/menu-button flex w-full items-center gap-2.5 overflow-hidden rounded-xl px-2.5 py-2 text-left text-xs font-medium outline-hidden ring-sidebar-ring transition-all duration-200 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
    {
        variants: {
            variant: {
                default: "hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
                outline:
                    "bg-background/60 shadow-xs hover:bg-sidebar-accent hover:text-sidebar-accent-foreground border border-sidebar-border/60",
            },
            size: {
                default: "h-9 text-xs",
                sm: "h-8 text-xs",
                lg: "h-11 text-sm group-data-[collapsible=icon]:p-0!",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
);

function SidebarMenuButton({
    asChild = false,
    isActive = false,
    variant = "default",
    size = "default",
    tooltip,
    className,
    ...props
}) {
    const Comp = asChild ? Slot : "button";
    const { isMobile, state } = useSidebar();
    const button = (
        <Comp
            data-slot="sidebar-menu-button"
            data-sidebar="menu-button"
            data-size={size}
            data-active={isActive}
            className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
            {...props}
        />
    );

    if (!tooltip) {
        return button;
    }

    if (typeof tooltip === "string") {
        tooltip = {
            children: tooltip,
        };
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent
                side="right"
                align="center"
                hidden={state !== "collapsed" || isMobile}
                className="bg-popover/95 backdrop-blur-md border border-sidebar-border shadow-xl text-xs font-medium px-2.5 py-1.5"
                {...tooltip}
            />
        </Tooltip>
    );
}

function SidebarMenuAction({ className, asChild = false, showOnHover = false, ...props }) {
    const Comp = asChild ? Slot : "button";
    return (
        <Comp
            data-slot="sidebar-menu-action"
            data-sidebar="menu-action"
            className={cn(
                "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground absolute top-2 right-1.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-3.5 [&>svg]:shrink-0",
                "group-data-[collapsible=icon]:hidden",
                showOnHover &&
                    "peer-data-[active=true]/menu-button:text-sidebar-accent-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0",
                className
            )}
            {...props}
        />
    );
}

function SidebarMenuBadge({ className, ...props }) {
    return (
        <div
            data-slot="sidebar-menu-badge"
            data-sidebar="menu-badge"
            className={cn(
                "text-sidebar-foreground/80 pointer-events-none absolute right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-accent/60 px-1.5 text-[10px] font-semibold tabular-nums select-none border border-sidebar-border/40",
                "group-data-[collapsible=icon]:hidden",
                className
            )}
            {...props}
        />
    );
}

function SidebarMenuSkeleton({ className, showIcon = false, ...props }) {
    const [skeletonStyle] = React.useState(() => ({
        "--skeleton-width": `${Math.floor(Math.random() * 40) + 50}%`,
    }));
    return (
        <div
            data-slot="sidebar-menu-skeleton"
            data-sidebar="menu-skeleton"
            className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)}
            {...props}
        >
            {showIcon && <Skeleton className="size-4 rounded-md" data-sidebar="menu-skeleton-icon" />}
            <Skeleton
                className="h-4 max-w-(--skeleton-width) flex-1"
                data-sidebar="menu-skeleton-text"
                style={skeletonStyle}
            />
        </div>
    );
}

function SidebarMenuSub({ className, ...props }) {
    return (
        <ul
            data-slot="sidebar-menu-sub"
            data-sidebar="menu-sub"
            className={cn(
                "border-sidebar-border/50 ml-5 flex min-w-0 translate-x-px flex-col gap-1 border-l-2 pl-3 py-1",
                "group-data-[collapsible=icon]:hidden",
                className
            )}
            {...props}
        />
    );
}

function SidebarMenuSubItem({ className, ...props }) {
    return (
        <li
            data-slot="sidebar-menu-sub-item"
            data-sidebar="menu-sub-item"
            className={cn("group/menu-sub-item relative list-none", className)}
            {...props}
        />
    );
}

function SidebarMenuSubButton({
    asChild = false,
    size = "md",
    isActive = false,
    className,
    ...props
}) {
    const Comp = asChild ? Slot : "a";
    return (
        <Comp
            data-slot="sidebar-menu-sub-button"
            data-sidebar="menu-sub-button"
            data-size={size}
            data-active={isActive}
            className={cn(
                "text-sidebar-foreground/80 ring-sidebar-ring hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground flex h-8 min-w-0 items-center gap-2 overflow-hidden rounded-lg px-2.5 text-xs outline-hidden transition-all duration-150 disabled:pointer-events-none disabled:opacity-50",
                "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-medium",
                size === "sm" && "text-[11px] h-7",
                size === "md" && "text-xs h-8",
                "group-data-[collapsible=icon]:hidden",
                className
            )}
            {...props}
        />
    );
}

export {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupAction,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInput,
    SidebarInset,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSkeleton,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarProvider,
    SidebarRail,
    SidebarSeparator,
    SidebarTrigger,
    useSidebar,
};
