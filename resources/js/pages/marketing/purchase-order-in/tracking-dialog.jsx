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
import { CheckCircle2, Search, Truck, X } from 'lucide-react';
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
            <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-[650px] rounded-2xl border border-sidebar-border/70 bg-card p-5 shadow-2xl">
                <DialogHeader className="border-b border-sidebar-border/60 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <Truck className="size-4" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-bold text-foreground">
                                Tracking PO Customer
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                Lacak riwayat status dan tahapan realisasi pesanan dengan memasukkan nomor Ref PO Customer.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto py-3">
                    <form
                        className="relative z-10 flex w-full items-center gap-2"
                        onSubmit={handleSearch}
                    >
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                className="h-9 w-full rounded-lg border border-sidebar-border/70 bg-background pl-8.5 pr-8 text-xs placeholder:text-muted-foreground/60 focus:border-emerald-500 focus:outline-none"
                                placeholder="Masukkan Ref PO Customer (contoh: PO-2024-001)..."
                                value={keyword}
                                onChange={(event) => {
                                    setKeyword(event.target.value);
                                    setResults([]);
                                    setHasSearchCompleted(false);
                                }}
                                disabled={isLoading}
                                aria-label="Ref PO Customer"
                            />
                            {keyword && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setKeyword('');
                                        setResults([]);
                                        setHasSearchCompleted(false);
                                    }}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                                >
                                    <X className="size-3.5" />
                                </button>
                            )}
                        </div>
                        <Button
                            type="submit"
                            size="sm"
                            disabled={isLoading}
                            className="h-9 px-4 gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                            style={{ backgroundColor: '#059669', color: '#ffffff' }}
                        >
                            <Search className="size-3.5" />
                            <span>{isLoading ? 'Mencari...' : 'Lacak'}</span>
                        </Button>
                    </form>

                    {results.length > 0 && (
                        <div className="rounded-xl border border-sidebar-border/70 bg-muted/20 p-4">
                            <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
                                <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Riwayat Proses & Realisasi</span>
                            </h4>
                            <ol
                                className="relative ml-2 space-y-3.5 border-l-2 border-emerald-500/40 pl-5 text-xs"
                                aria-label="Hasil tracking PO Customer"
                            >
                                {results.map((result, index) => (
                                    <li
                                        key={`${index}-${result}`}
                                        className="relative"
                                    >
                                        <span
                                            className="absolute top-1 -left-[27px] z-10 size-3 rounded-full border-2 border-background bg-emerald-600 dark:bg-emerald-400"
                                            aria-hidden="true"
                                        />
                                        <div className="rounded-lg border border-sidebar-border/70 bg-card p-3 text-xs shadow-xs text-foreground font-medium whitespace-pre-wrap leading-relaxed">
                                            {result}
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}

                    {!isLoading &&
                        hasSearchCompleted &&
                        results.length === 0 && (
                            <div
                                className="rounded-xl border border-sidebar-border/70 bg-card p-8 text-center text-xs text-muted-foreground"
                                role="status"
                            >
                                Tidak ditemukan riwayat tracking untuk Ref PO tersebut. Pastikan Ref PO yang dimasukkan sudah sesuai.
                            </div>
                        )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
