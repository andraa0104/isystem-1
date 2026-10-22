import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    createLatestRequest,
    readPoInTrackingResponse,
} from '@/lib/purchase-order-in';
import { useEffect, useRef, useState } from 'react';

export default function TrackingDialog({ open, onOpenChange, onError }) {
    const [keyword, setKeyword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [hasSearchCompleted, setHasSearchCompleted] = useState(false);
    const request = useRef(createLatestRequest());

    useEffect(() => () => request.current.cancel(), []);

    const handleOpenChange = (nextOpen) => {
        if (!nextOpen) {
            request.current.cancel();
            setIsLoading(false);
            setKeyword('');
            setResults([]);
            setHasSearchCompleted(false);
        } else {
            setKeyword('');
            setResults([]);
            setHasSearchCompleted(false);
        }
        onOpenChange(nextOpen);
    };

    const handleSearch = async (event) => {
        event.preventDefault();
        const refPo = keyword.trim();
        if (!refPo) {
            onError('Silakan masukkan Ref PO');
            return;
        }

        const { signal, isCurrent } = request.current.start();
        setIsLoading(true);
        setResults([]);
        setHasSearchCompleted(false);

        try {
            const response = await fetch(
                `/marketing/purchase-order-in/tracking?ref_po=${encodeURIComponent(refPo)}`,
                {
                    signal,
                    cache: 'no-store',
                    headers: { Accept: 'application/json' },
                },
            );
            const data = await readPoInTrackingResponse(response);
            if (isCurrent()) {
                setResults(data);
                setHasSearchCompleted(true);
            }
        } catch (error) {
            if (isCurrent()) {
                onError(error?.message || 'Gagal menghubungi server');
            }
        } finally {
            if (isCurrent()) setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-[700px]">
                <DialogHeader>
                    <DialogTitle>Tracking PO Customer</DialogTitle>
                    <DialogDescription>
                        Anda bisa melacak status PO Customer dengan memasukkan
                        Ref PO di bawah ini.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex min-h-0 flex-col gap-4 overflow-y-auto py-4">
                    <form
                        className="relative z-10 mb-2 flex w-full gap-2"
                        onSubmit={handleSearch}
                    >
                        <input
                            type="text"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Masukkan Ref PO..."
                            value={keyword}
                            onChange={(event) => {
                                setKeyword(event.target.value);
                                setResults([]);
                                setHasSearchCompleted(false);
                            }}
                            disabled={isLoading}
                            aria-label="Ref PO Customer"
                        />
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? 'Mencari...' : 'Cari Data'}
                        </Button>
                    </form>

                    {results.length > 0 && (
                        <ol
                            className="relative mt-4 ml-3 space-y-4 border-l-2 border-blue-500 pl-6"
                            aria-label="Hasil tracking PO Customer"
                        >
                            {results.map((result, index) => (
                                <li
                                    key={`${index}-${result}`}
                                    className="relative"
                                >
                                    <span
                                        className="absolute top-1 -left-[31px] z-10 h-4 w-4 rounded-full border-2 border-white bg-blue-500 dark:border-slate-900"
                                        aria-hidden="true"
                                    />
                                    <div className="rounded-md border bg-slate-100 p-3 text-sm shadow-sm dark:bg-slate-800">
                                        {result}
                                    </div>
                                </li>
                            ))}
                        </ol>
                    )}

                    {!isLoading &&
                        hasSearchCompleted &&
                        results.length === 0 && (
                            <div
                                className="mt-4 text-center text-sm text-muted-foreground"
                                role="status"
                            >
                                Tidak ada data untuk Ref PO tersebut.
                            </div>
                        )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
