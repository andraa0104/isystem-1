import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const getErrorParts = (error) => {
    if (!error) return { summary: 'Terjadi kesalahan.', detail: undefined, status: undefined };
    if (typeof error === 'string') return { summary: error, detail: undefined, status: undefined };
    return {
        summary: error.summary || error.message || 'Terjadi kesalahan.',
        detail: error.detail || error.stack,
        status: error.status,
    };
};

export function ErrorState({ error, onRetry }) {
    const { summary, detail, status } = getErrorParts(error);

    return (
        <Alert variant="destructive" className="w-full">
            <AlertTitle className="flex flex-wrap items-center justify-between gap-2">
                <span>{status ? `Error ${status}` : 'Error'}</span>
                {onRetry ? (
                    <Button type="button" size="sm" variant="outline" onClick={onRetry}>
                        Coba lagi
                    </Button>
                ) : null}
            </AlertTitle>
            <AlertDescription className="w-full">
                <div className="whitespace-pre-wrap break-words">{summary}</div>
                {detail ? (
                    <details className="mt-2">
                        <summary className="cursor-pointer select-none text-xs underline underline-offset-2">
                            Detail error
                        </summary>
                        <pre className="mt-2 max-h-56 overflow-auto rounded-md border border-destructive/30 bg-background/60 p-2 text-[11px] leading-snug text-foreground whitespace-pre-wrap break-words">
                            {String(detail)}
                        </pre>
                    </details>
                ) : null}
            </AlertDescription>
        </Alert>
    );
}

