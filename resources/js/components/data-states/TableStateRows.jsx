import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/data-states/ErrorState';
import { TableCell, TableRow } from '@/components/ui/table';

const SkeletonCells = ({ columns }) => {
    const widths = ['w-3/5', 'w-4/5', 'w-2/5', 'w-1/2'];
    return Array.from({ length: columns }).map((_, index) => (
        <div key={index} className="py-1">
            <Skeleton className={`h-4 ${widths[index % widths.length]}`} />
        </div>
    ));
};

const EmptyRowContent = ({ title, description, actionLabel, actionHref, onAction }) => {
    return (
        <div className="flex flex-col items-center justify-center gap-2 py-2 text-center">
            <div className="font-medium text-foreground">{title || 'Tidak ada data.'}</div>
            {description ? (
                <div className="max-w-xl text-sm text-muted-foreground">{description}</div>
            ) : null}
            {actionLabel && (actionHref || onAction) ? (
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    asChild={Boolean(actionHref)}
                    onClick={actionHref ? undefined : onAction}
                >
                    {actionHref ? <a href={actionHref}>{actionLabel}</a> : actionLabel}
                </Button>
            ) : null}
        </div>
    );
};

export function ShadcnTableStateRows({
    columns,
    loading,
    error,
    onRetry,
    isEmpty,
    skeletonRows = 5,
    emptyTitle,
    emptyDescription,
    emptyActionLabel,
    emptyActionHref,
    onEmptyAction,
}) {
    if (loading) {
        return Array.from({ length: skeletonRows }).map((_, rowIndex) => (
            <TableRow key={`sk-${rowIndex}`}>
                <TableCell colSpan={columns} className="py-3">
                    <SkeletonCells columns={Math.min(columns, 6)} />
                </TableCell>
            </TableRow>
        ));
    }

    if (error) {
        return (
            <TableRow>
                <TableCell colSpan={columns} className="py-3">
                    <ErrorState error={error} onRetry={onRetry} />
                </TableCell>
            </TableRow>
        );
    }

    if (isEmpty) {
        return (
            <TableRow>
                <TableCell colSpan={columns} className="py-6">
                    <EmptyRowContent
                        title={emptyTitle}
                        description={emptyDescription}
                        actionLabel={emptyActionLabel}
                        actionHref={emptyActionHref}
                        onAction={onEmptyAction}
                    />
                </TableCell>
            </TableRow>
        );
    }

    return null;
}

export function PlainTableStateRows({
    columns,
    loading,
    error,
    onRetry,
    isEmpty,
    skeletonRows = 5,
    emptyTitle,
    emptyDescription,
    emptyActionLabel,
    emptyActionHref,
    onEmptyAction,
}) {
    if (loading) {
        return Array.from({ length: skeletonRows }).map((_, rowIndex) => (
            <tr key={`sk-${rowIndex}`} className="border-t border-sidebar-border/70">
                <td colSpan={columns} className="px-4 py-3">
                    <SkeletonCells columns={Math.min(columns, 6)} />
                </td>
            </tr>
        ));
    }

    if (error) {
        return (
            <tr className="border-t border-sidebar-border/70">
                <td colSpan={columns} className="px-4 py-3">
                    <ErrorState error={error} onRetry={onRetry} />
                </td>
            </tr>
        );
    }

    if (isEmpty) {
        return (
            <tr className="border-t border-sidebar-border/70">
                <td colSpan={columns} className="px-4 py-6">
                    <EmptyRowContent
                        title={emptyTitle}
                        description={emptyDescription}
                        actionLabel={emptyActionLabel}
                        actionHref={emptyActionHref}
                        onAction={onEmptyAction}
                    />
                </td>
            </tr>
        );
    }

    return null;
}

