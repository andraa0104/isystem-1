import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useEffect, useId, useRef, useState } from 'react';

export default function QuotationAttendInput({
    id,
    customer = '',
    value = '',
    onValueChange,
}) {
    const listId = useId();
    const listRef = useRef(null);
    const inputRef = useRef(null);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [options, setOptions] = useState([]);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [active, setActive] = useState(-1);
    const [retry, setRetry] = useState(0);

    const trimmedCustomer = (customer ?? '').trim();

    // Muat saran Attend saat dropdown terbuka, customer berubah, atau kueri pencarian berubah
    useEffect(() => {
        if (!open) return;

        // Jika customer belum dipilih/diisi, jangan tampilkan attend acak dari semua database
        if (!trimmedCustomer) {
            setOptions([]);
            setLoading(false);
            setHasMore(false);
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        setError('');
        const timer = setTimeout(
            async () => {
                try {
                    const params = new URLSearchParams({
                        search: search.trim(),
                        customer: trimmedCustomer,
                        page: String(page),
                    });
                    const response = await fetch(
                        `/marketing/quotation/attends?${params}`,
                        {
                            headers: { Accept: 'application/json' },
                            signal: controller.signal,
                        },
                    );
                    if (!response.ok) throw new Error('Request failed');
                    const data = await response.json();
                    if (controller.signal.aborted) return;
                    const rows = Array.isArray(data.attends)
                        ? data.attends
                        : [];
                    setOptions((previous) =>
                        page === 1
                            ? rows
                            : [...new Set([...previous, ...rows])],
                    );
                    setHasMore(Boolean(data.has_more));
                } catch {
                    if (!controller.signal.aborted)
                        setError('Gagal memuat saran Attend.');
                } finally {
                    if (!controller.signal.aborted) setLoading(false);
                }
            },
            search === '' ? 0 : 150,
        );
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [open, search, trimmedCustomer, page, retry]);

    // Scroll opsi aktif ke dalam viewport dropdown
    useEffect(() => {
        if (active >= 0) {
            listRef.current
                ?.querySelector('[data-active="true"]')
                ?.scrollIntoView({ block: 'nearest' });
        }
    }, [active]);

    const openList = () => {
        const currentVal = (value ?? '').trim();
        setSearch(currentVal);
        setPage(1);
        setActive(-1);
        setOpen(true);
    };

    const choose = (attend) => {
        onValueChange(attend);
        setOpen(false);
        setActive(-1);
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

    // Cari saran terbaik: prioritaskan yang diawali teks yang diketik (prefix match)
    const valTrimmed = (value ?? '').trim();
    const prefixMatch =
        valTrimmed !== ''
            ? options.find((opt) =>
                  opt.toLowerCase().startsWith(valTrimmed.toLowerCase()),
              )
            : undefined;

    const activeOption =
        active >= 0 && active < options.length ? options[active] : undefined;

    const suggestedAttend =
        open && valTrimmed !== ''
            ? activeOption ?? prefixMatch ?? options[0]
            : undefined;

    // Hitung samaran (ghost text) jika saran diawali teks yang diketik user
    const completion =
        suggestedAttend &&
        valTrimmed !== '' &&
        suggestedAttend.toLowerCase().startsWith(value.toLowerCase()) &&
        suggestedAttend.toLowerCase() !== value.toLowerCase()
            ? suggestedAttend.slice(value.length)
            : '';

    return (
        <div
            className="relative w-full"
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    setOpen(false);
                }
            }}
        >
            <div className="relative">
                <Input
                    ref={inputRef}
                    id={id}
                    value={value}
                    role="combobox"
                    autoComplete="off"
                    spellCheck="false"
                    aria-autocomplete="both"
                    aria-describedby={
                        suggestedAttend ? `${listId}-hint` : undefined
                    }
                    onScroll={(event) =>
                        setScrollLeft(event.currentTarget.scrollLeft)
                    }
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-activedescendant={
                        open && active >= 0 ? `${listId}-${active}` : undefined
                    }
                    onFocus={openList}
                    onClick={openList}
                    onChange={(event) => {
                        const nextVal = event.target.value;
                        onValueChange(nextVal);
                        setSearch(nextVal);
                        setPage(1);
                        setActive(-1);
                        setOpen(true);
                    }}
                    onKeyDown={(event) => {
                        if (
                            event.key === 'ArrowDown' ||
                            event.key === 'ArrowUp'
                        ) {
                            event.preventDefault();
                            if (!open) {
                                openList();
                                return;
                            }
                            setActive((previous) =>
                                event.key === 'ArrowDown'
                                    ? Math.min(previous + 1, options.length - 1)
                                    : Math.max(
                                          previous - 1,
                                          options.length ? 0 : -1,
                                      ),
                            );
                        } else if (
                            event.key === 'Tab' &&
                            !event.shiftKey &&
                            !event.ctrlKey &&
                            !event.altKey &&
                            !event.metaKey &&
                            !event.nativeEvent.isComposing &&
                            open &&
                            valTrimmed !== '' &&
                            suggestedAttend
                        ) {
                            event.preventDefault();
                            choose(suggestedAttend);
                        } else if (
                            event.key === 'Enter' &&
                            open &&
                            suggestedAttend
                        ) {
                            event.preventDefault();
                            choose(suggestedAttend);
                        } else if (
                            event.key === 'ArrowRight' &&
                            completion &&
                            inputRef.current?.selectionStart === value.length &&
                            inputRef.current?.selectionEnd === value.length &&
                            suggestedAttend
                        ) {
                            event.preventDefault();
                            choose(suggestedAttend);
                        } else if (event.key === 'Escape' && open) {
                            event.preventDefault();
                            setOpen(false);
                        }
                    }}
                />

                {/* Samaran (Ghost text) kelanjutan nama persis di dalam kotak isian */}
                {completion && (
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 z-10 flex items-center overflow-hidden rounded-md border border-transparent px-3 py-1 text-base select-none whitespace-pre md:text-sm font-sans"
                    >
                        <span
                            className="shrink-0"
                            style={{
                                transform: `translateX(-${scrollLeft}px)`,
                            }}
                        >
                            <span className="invisible">{value}</span>
                            <span className="text-muted-foreground/60 dark:text-muted-foreground/60 font-normal">
                                {completion}
                            </span>
                        </span>
                    </div>
                )}
            </div>

            {/* Informasi UX ramah pengguna jika nama sesuai */}
            {suggestedAttend && (
                <p
                    id={`${listId}-hint`}
                    role="status"
                    className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
                >
                    <span>Ketik</span>
                    <kbd className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground shadow-2xs">
                        Tab ⇥
                    </kbd>
                    <span>jika nama sudah sesuai:</span>
                    <span className="font-semibold text-foreground">
                        {suggestedAttend}
                    </span>
                </p>
            )}

            {/* Dropdown Rekomendasi Attend saat user mengklik field */}
            {open && (
                <div className="absolute top-full z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
                    <ul
                        id={listId}
                        ref={listRef}
                        role="listbox"
                        aria-label="Rekomendasi Attend"
                        aria-busy={loading}
                        className="max-h-56 overflow-y-auto p-1"
                    >
                        {options.map((attend, index) => {
                            const isCurrentActive =
                                index === active ||
                                (active === -1 && attend === suggestedAttend);

                            return (
                                <li
                                    key={`${attend}-${index}`}
                                    id={`${listId}-${index}`}
                                    role="option"
                                    aria-selected={isCurrentActive}
                                    data-active={isCurrentActive}
                                    className={cn(
                                        'cursor-pointer rounded-sm px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                                        isCurrentActive &&
                                            'bg-accent text-accent-foreground font-medium',
                                    )}
                                    onMouseDown={(event) =>
                                        event.preventDefault()
                                    }
                                    onMouseEnter={() => setActive(index)}
                                    onClick={() => choose(attend)}
                                >
                                    {attend}
                                </li>
                            );
                        })}
                    </ul>
                    <div
                        className="px-3 py-2 text-xs text-muted-foreground border-t bg-muted/20"
                        role="status"
                    >
                        {loading
                            ? 'Memuat saran Attend…'
                            : error ||
                              (!trimmedCustomer
                                  ? 'Pilih / isi Nama Customer terlebih dahulu untuk melihat saran Attend.'
                                  : options.length === 0
                                    ? `Belum ada riwayat Attend untuk customer "${trimmedCustomer}". Anda dapat mengetik nama baru.`
                                    : 'Klik nama, gunakan panah ↑↓, atau ketik Tab untuk memilih.')}
                    </div>
                    {!loading && error && (
                        <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm text-primary hover:bg-accent"
                            onClick={() => setRetry((previous) => previous + 1)}
                        >
                            Coba lagi
                        </button>
                    )}
                    {!loading && !error && hasMore && (
                        <button
                            type="button"
                            className="w-full border-t px-3 py-2 text-left text-sm text-primary hover:bg-accent font-medium"
                            onClick={() => setPage((previous) => previous + 1)}
                        >
                            Tampilkan lainnya
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
