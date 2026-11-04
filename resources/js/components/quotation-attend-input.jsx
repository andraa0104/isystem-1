import { Input } from '@/components/ui/input';
import { useEffect, useId, useRef, useState } from 'react';

export default function QuotationAttendInput({ id, value, onValueChange }) {
    const listId = useId();
    const listRef = useRef(null);
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

    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();
        setLoading(true);
        setError('');
        const timer = setTimeout(
            async () => {
                try {
                    const params = new URLSearchParams({
                        search,
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
                        setError('Gagal memuat Attend.');
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
    }, [open, search, page, retry]);

    useEffect(() => {
        if (active >= 0) {
            listRef.current
                ?.querySelector('[data-active="true"]')
                ?.scrollIntoView({ block: 'nearest' });
        }
    }, [active]);

    const openList = () => {
        if (open) return;
        setSearch(value.trim());
        setPage(1);
        setOptions([]);
        setHasMore(false);
        setActive(-1);
        setOpen(true);
    };

    const choose = (attend) => {
        onValueChange(attend);
        setOpen(false);
        setActive(-1);
    };

    const suggestedAttend =
        open && value.trim() !== ''
            ? options[active >= 0 ? active : 0]
            : undefined;
    const completion =
        suggestedAttend &&
        suggestedAttend.toLowerCase().startsWith(value.toLowerCase())
            ? suggestedAttend.slice(value.length)
            : '';

    return (
        <div
            className="relative"
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget))
                    setOpen(false);
            }}
        >
            <div className="relative">
                {completion && (
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 flex items-center overflow-hidden rounded-md border border-transparent px-3 py-1 text-base whitespace-pre md:text-sm"
                    >
                        <span
                            className="shrink-0"
                            style={{
                                transform: `translateX(-${scrollLeft}px)`,
                            }}
                        >
                            <span className="invisible">{value}</span>
                            <span className="text-muted-foreground/60">
                                {completion}
                            </span>
                        </span>
                    </div>
                )}
                <Input
                    id={id}
                    value={value}
                    role="combobox"
                    autoComplete="off"
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
                    onFocus={(event) => {
                        event.currentTarget.select();
                        openList();
                    }}
                    onClick={(event) => {
                        event.currentTarget.select();
                        openList();
                    }}
                    onChange={(event) => {
                        onValueChange(event.target.value);
                        setSearch(event.target.value);
                        setPage(1);
                        setOptions([]);
                        setHasMore(false);
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
                            value.trim() !== ''
                        ) {
                            if (suggestedAttend) choose(suggestedAttend);
                        } else if (
                            event.key === 'Enter' &&
                            open &&
                            active >= 0
                        ) {
                            event.preventDefault();
                            choose(options[active]);
                        } else if (event.key === 'Escape' && open) {
                            event.preventDefault();
                            setOpen(false);
                        }
                    }}
                />
            </div>
            {suggestedAttend && (
                <p
                    id={`${listId}-hint`}
                    role="status"
                    className="mt-1 text-xs text-muted-foreground"
                >
                    Tekan Tab jika nama sudah sesuai:{' '}
                    <span className="font-medium">{suggestedAttend}</span>.
                </p>
            )}
            {open && (
                <div className="absolute top-full z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
                    <ul
                        id={listId}
                        ref={listRef}
                        role="listbox"
                        aria-label="Attend tersimpan"
                        aria-busy={loading}
                        className="max-h-56 overflow-y-auto p-1"
                    >
                        {options.map((attend, index) => (
                            <li
                                key={attend}
                                id={`${listId}-${index}`}
                                role="option"
                                aria-selected={index === active}
                                data-active={index === active}
                                className={`cursor-pointer rounded-sm px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground ${index === active ? 'bg-accent text-accent-foreground' : ''}`}
                                onMouseDown={(event) => event.preventDefault()}
                                onMouseEnter={() => setActive(index)}
                                onClick={() => choose(attend)}
                            >
                                {attend}
                            </li>
                        ))}
                    </ul>
                    <div
                        className="px-3 py-2 text-xs text-muted-foreground"
                        role="status"
                    >
                        {loading
                            ? 'Memuat Attend…'
                            : error ||
                              (options.length === 0
                                  ? 'Tidak ada Attend yang cocok. Anda tetap dapat mengetik nama baru.'
                                  : 'Pilih saran dengan klik atau tombol panah. Anda juga dapat mengetik nama baru.')}
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
                            className="w-full border-t px-3 py-2 text-left text-sm text-primary hover:bg-accent"
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
