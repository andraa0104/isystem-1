import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

export default function QuotationAttendInput({ id, value = '', onValueChange }) {
    const inputRef = useRef(null);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [isFocused, setIsFocused] = useState(false);
    const [options, setOptions] = useState([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [dismissed, setDismissed] = useState(false);

    // Fetch saran Attend saat user mengetik
    useEffect(() => {
        const trimmed = (value ?? '').trim();
        if (!isFocused || trimmed === '' || dismissed) {
            setOptions([]);
            return;
        }

        const controller = new AbortController();
        const timer = setTimeout(async () => {
            try {
                const params = new URLSearchParams({
                    search: trimmed,
                    page: '1',
                });
                const response = await fetch(
                    `/marketing/quotation/attends?${params}`,
                    {
                        headers: { Accept: 'application/json' },
                        signal: controller.signal,
                    },
                );
                if (!response.ok) return;
                const data = await response.json();
                if (controller.signal.aborted) return;

                const rows = Array.isArray(data.attends) ? data.attends : [];
                setOptions(rows);
                setActiveIndex(0);
            } catch {
                // Ignore abort / network errors
            }
        }, 150);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [value, isFocused, dismissed]);

    // Filter & prioritaskan saran: yang startsWith ditaruh di awal
    const trimmedVal = (value ?? '').trim();
    const matched = options
        .filter((opt) =>
            opt.toLowerCase().includes(trimmedVal.toLowerCase()),
        )
        .sort((a, b) => {
            const aStarts = a.toLowerCase().startsWith(trimmedVal.toLowerCase());
            const bStarts = b.toLowerCase().startsWith(trimmedVal.toLowerCase());
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return a.localeCompare(b);
        });

    // Ambil saran saat ini jika tidak sama persis dengan value yang diketik
    const currentSuggestion =
        !dismissed && matched.length > 0
            ? matched[Math.min(activeIndex, matched.length - 1)]
            : null;

    const isExactMatch =
        currentSuggestion &&
        currentSuggestion.toLowerCase() === (value ?? '').toLowerCase();

    const suggestedAttend =
        currentSuggestion && !isExactMatch ? currentSuggestion : null;

    // Hitung completion ghost text jika diawali dengan teks yang diketik
    const completion =
        suggestedAttend &&
        suggestedAttend.toLowerCase().startsWith((value ?? '').toLowerCase())
            ? suggestedAttend.slice((value ?? '').length)
            : '';

    const choose = (attend) => {
        onValueChange(attend);
        setDismissed(true);
        setOptions([]);
        setActiveIndex(0);
        if (inputRef.current) {
            inputRef.current.focus();
            requestAnimationFrame(() => {
                if (inputRef.current) {
                    const len = attend.length;
                    inputRef.current.setSelectionRange(len, len);
                }
            });
        }
    };

    return (
        <div className="relative w-full">
            {/* Ghost text di dalam kotak isian */}
            {completion && isFocused && (
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 flex items-center overflow-hidden rounded-md border border-transparent px-3 py-1 text-base select-none whitespace-pre md:text-sm"
                >
                    <span
                        className="shrink-0"
                        style={{
                            transform: `translateX(-${scrollLeft}px)`,
                        }}
                    >
                        <span className="invisible">{value}</span>
                        <span className="text-muted-foreground/50 font-normal">
                            {completion}
                        </span>
                    </span>
                </div>
            )}

            {/* Input field */}
            <Input
                ref={inputRef}
                id={id}
                value={value}
                autoComplete="off"
                spellCheck="false"
                className={cn(
                    'w-full bg-transparent font-normal',
                    suggestedAttend && isFocused ? 'pr-20' : 'pr-3',
                )}
                onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
                onFocus={() => {
                    setIsFocused(true);
                    setDismissed(false);
                }}
                onBlur={(e) => {
                    // Cek jika blur bukan karena klik badge di dalam container
                    if (!e.currentTarget.parentElement?.contains(e.relatedTarget)) {
                        setIsFocused(false);
                    }
                }}
                onChange={(e) => {
                    onValueChange(e.target.value);
                    setDismissed(false);
                }}
                onKeyDown={(e) => {
                    if (
                        e.key === 'Tab' &&
                        !e.shiftKey &&
                        !e.ctrlKey &&
                        !e.altKey &&
                        !e.metaKey &&
                        !e.nativeEvent.isComposing &&
                        suggestedAttend
                    ) {
                        e.preventDefault();
                        choose(suggestedAttend);
                    } else if (e.key === 'Enter' && suggestedAttend) {
                        e.preventDefault();
                        choose(suggestedAttend);
                    } else if (
                        e.key === 'ArrowRight' &&
                        suggestedAttend &&
                        completion &&
                        inputRef.current?.selectionStart === (value ?? '').length &&
                        inputRef.current?.selectionEnd === (value ?? '').length
                    ) {
                        e.preventDefault();
                        choose(suggestedAttend);
                    } else if (e.key === 'ArrowDown' && matched.length > 1) {
                        e.preventDefault();
                        setActiveIndex((prev) => (prev + 1) % matched.length);
                    } else if (e.key === 'ArrowUp' && matched.length > 1) {
                        e.preventDefault();
                        setActiveIndex(
                            (prev) => (prev - 1 + matched.length) % matched.length,
                        );
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setDismissed(true);
                    }
                }}
            />

            {/* Indikator saran di dalam kotak isian (sebelah kanan dalam input) */}
            {suggestedAttend && isFocused && (
                <div className="pointer-events-auto absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 select-none">
                    {matched.length > 1 && (
                        <span className="text-[10px] text-muted-foreground/80 font-medium">
                            {activeIndex + 1}/{matched.length}
                        </span>
                    )}
                    <button
                        type="button"
                        tabIndex={-1}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => choose(suggestedAttend)}
                        className="inline-flex items-center gap-0.5 rounded border border-border/60 bg-muted/90 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground shadow-2xs hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                        title="Tekan Tab atau klik untuk melengkapi"
                    >
                        <span>Tab</span>
                        <span className="text-[10px] opacity-70">⇥</span>
                    </button>
                </div>
            )}
        </div>
    );
}
