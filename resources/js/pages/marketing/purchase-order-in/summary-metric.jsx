import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

export const formatRupiah = (value) =>
    `${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;

export const SummaryLoadError = ({
    label,
    onRetry,
    message = 'Gagal memuat',
}) => (
    <div className="space-y-2" role="alert">
        <p className="text-sm font-medium text-destructive">{message}</p>
        <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-auto max-w-full py-1 text-xs whitespace-normal"
            aria-label={`Coba lagi memuat ${label}`}
            onClick={onRetry}
        >
            Coba lagi
        </Button>
    </div>
);

export const SummaryMetric = ({
    label,
    value,
    grandTotal,
    grandTotalHint,
    loading,
    error,
    onRetry,
    onClick,
    icon,
    soonCount,
    overdueCount,
}) => {
    const metricButton = (
        <button
            type="button"
            className="w-full min-w-0 rounded-lg px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-busy={loading}
            onClick={onClick}
        >
            <p className="flex items-center gap-1 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                {label}
                {icon}
            </p>
            {error && !loading ? (
                <span className="sr-only">Gagal memuat ringkasan</span>
            ) : (
                <>
                    <div className="mt-1 text-xl font-bold">
                        {loading ? <Skeleton className="h-6 w-10" /> : value}
                    </div>
                    {grandTotal !== undefined && (
                        <div className="mt-2">
                            <p className="flex items-center gap-1 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                                Grand Total
                                {grandTotalHint && (
                                    <Info
                                        className="size-3 shrink-0"
                                        aria-hidden="true"
                                    />
                                )}
                            </p>
                            <div className="mt-1 text-sm font-semibold break-words tabular-nums">
                                {loading ? (
                                    <Skeleton className="h-5 w-24" />
                                ) : (
                                    `Rp ${formatRupiah(grandTotal)}`
                                )}
                            </div>
                        </div>
                    )}
                    {(soonCount !== undefined ||
                        overdueCount !== undefined) && (
                        <div className="mt-2 space-y-1 border-t border-sidebar-border/50 pt-2 text-[14px]">
                            {soonCount !== undefined && (
                                <div className="flex justify-between text-amber-600 dark:text-amber-500">
                                    <span>≤ 5 Hari:</span>
                                    <span className="font-bold">
                                        {loading ? '-' : soonCount}
                                    </span>
                                </div>
                            )}
                            {overdueCount !== undefined && (
                                <div className="flex justify-between text-rose-600 dark:text-rose-500">
                                    <span>Lewat:</span>
                                    <span className="font-bold">
                                        {loading ? '-' : overdueCount}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </button>
    );

    return (
        <div className="min-w-0 rounded-lg border border-sidebar-border/70 transition hover:border-primary/50 hover:bg-muted/40">
            {grandTotalHint ? (
                <Tooltip>
                    <TooltipTrigger asChild>{metricButton}</TooltipTrigger>
                    <TooltipContent className="max-w-64">
                        {grandTotalHint}
                    </TooltipContent>
                </Tooltip>
            ) : (
                metricButton
            )}
            {error && !loading && (
                <div className="px-3 pb-2">
                    <SummaryLoadError label={label} onRetry={onRetry} />
                </div>
            )}
        </div>
    );
};
