import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Fragment } from 'react';

export function Breadcrumbs({ breadcrumbs }) {
    if (!breadcrumbs || breadcrumbs.length === 0) {
        return null;
    }

    return (
        <Breadcrumb>
            <BreadcrumbList className="flex-nowrap overflow-x-auto scrollbar-none gap-1 sm:gap-1.5">
                {breadcrumbs.map((item, index) => {
                    const isLast = index === breadcrumbs.length - 1;
                    return (
                        <Fragment key={`${item.title}-${index}`}>
                            <BreadcrumbItem className="shrink-0">
                                {isLast ? (
                                    <motion.div
                                        initial={{ opacity: 0, x: -4 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <BreadcrumbPage className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                            {item.title}
                                        </BreadcrumbPage>
                                    </motion.div>
                                ) : (
                                    <BreadcrumbLink asChild>
                                        <Link
                                            href={item.href}
                                            className="rounded-lg px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                                        >
                                            {item.title}
                                        </Link>
                                    </BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                            {!isLast && (
                                <BreadcrumbSeparator className="text-muted-foreground/50">
                                    <ChevronRight className="size-3.5" />
                                </BreadcrumbSeparator>
                            )}
                        </Fragment>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
