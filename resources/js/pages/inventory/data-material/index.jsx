import { ActionIconButton } from '@/components/action-icon-button';
import { ErrorState } from '@/components/data-states/ErrorState';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { normalizeApiError, readApiError } from '@/lib/api-error';
import { confirmDelete } from '@/lib/confirm-delete';
import { Head } from '@inertiajs/react';
import { ChevronDown, Loader2, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Inventory', href: '/inventory/data-material' },
    { title: 'Data Material', href: '/inventory/data-material' },
];

const formatNumber = (value) => {
    if (value === null || value === undefined || value === '') return '';
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(
        Number(value),
    );
};

const getCsrfToken = () => {
    const el = document.querySelector('meta[name="csrf-token"]');
    return el?.getAttribute('content') || '';
};

function SectionCollapse({ id, label }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState([]);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [pageSize, setPageSize] = useState(5);
    const [currentPage, setCurrentPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState(null);
    const [period, setPeriod] = useState(id === 'mi' ? 'today' : 'all');
    const [startDate, setStartDate] = useState(
        new Date().toISOString().split('T')[0],
    );
    const [endDate, setEndDate] = useState(
        new Date().toISOString().split('T')[0],
    );

    // Debounce search so typing doesn't spam requests / steal focus.
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
        }, 400);
        return () => clearTimeout(handler);
    }, [search]);

    // Reset to page 1 when filters change.
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, pageSize, period, startDate, endDate]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                params.set('key', id);
                params.set('search', debouncedSearch);
                params.set('page', String(currentPage));
                params.set(
                    'pageSize',
                    pageSize === 'all' ? 'all' : String(pageSize),
                );
                params.set('period', period);
                if (period === 'range') {
                    params.set('startDate', startDate);
                    params.set('endDate', endDate);
                }

                const res = await fetch(
                    `/inventory/data-material/rows?${params.toString()}`,
                    { headers: { Accept: 'application/json' } },
                );
                if (!res.ok) throw await readApiError(res);
                const data = await res.json();
                if (!cancelled) {
                    setRows(Array.isArray(data?.rows) ? data.rows : []);
                    setTotal(Number(data?.total ?? 0));
                }
            } catch (err) {
                if (!cancelled) {
                    setError(normalizeApiError(err, 'Gagal memuat data.'));
                    setRows([]);
                    setTotal(0);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [
        open,
        id,
        debouncedSearch,
        pageSize,
        currentPage,
        period,
        startDate,
        endDate,
    ]);

    const reload = async () => {
        if (!open) return;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            params.set('key', id);
            params.set('search', debouncedSearch);
            params.set('page', String(currentPage));
            params.set(
                'pageSize',
                pageSize === 'all' ? 'all' : String(pageSize),
            );
            params.set('period', period);
            if (period === 'range') {
                params.set('startDate', startDate);
                params.set('endDate', endDate);
            }

            const res = await fetch(
                `/inventory/data-material/rows?${params.toString()}`,
                {
                    headers: { Accept: 'application/json' },
                },
            );
            if (!res.ok) throw await readApiError(res);
            const data = await res.json();
            setRows(Array.isArray(data?.rows) ? data.rows : []);
            setTotal(Number(data?.total ?? 0));
        } catch (err) {
            setError(normalizeApiError(err, 'Gagal memuat data.'));
            setRows([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (row) => {
        const rowId = row?.id;
        if (!rowId) return;

        const ok = await confirmDelete({
            title: 'Hapus data?',
            text: 'Data yang dihapus tidak bisa dikembalikan.',
        });
        if (!ok) return;

        try {
            const res = await fetch('/inventory/data-material/row', {
                method: 'DELETE',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': getCsrfToken(),
                },
                credentials: 'same-origin',
                body: JSON.stringify({ key: id, id: rowId }),
            });
            if (!res.ok) throw await readApiError(res);
            const data = await res.json().catch(() => ({}));
            await Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: data?.message || 'Berhasil dihapus.',
                showConfirmButton: false,
                timer: 2500,
                timerProgressBar: true,
            });
            await reload();
        } catch (e) {
            const normalized = normalizeApiError(e, 'Gagal menghapus data.');
            await Swal.fire({
                icon: 'error',
                title: normalized.summary || 'Gagal menghapus data.',
                html: normalized.detail
                    ? `<pre style="text-align:left;white-space:pre-wrap;max-height:240px;overflow:auto;margin:0;">${String(
                          normalized.detail,
                      )
                          .replace(/&/g, '&amp;')
                          .replace(/</g, '&lt;')
                          .replace(/>/g, '&gt;')}</pre>`
                    : undefined,
            });
        }
    };

    const totalPages = useMemo(() => {
        if (pageSize === 'all') return 1;
        const size = Number(pageSize) || 5;
        return Math.max(1, Math.ceil(total / size));
    }, [pageSize, total]);

    const columns = useMemo(() => {
        if (id === 'mib') {
            return [
                'No MIB',
                'Material',
                'Qty',
                'Satuan',
                'Price',
                'Total Price',
                'MIB',
                'Aksi',
            ];
        }
        return [
            'No MI',
            'Date',
            'Ref PO',
            'Material',
            'Qty',
            'Satuan',
            'Price',
            'Total Price',
            id === 'mis' ? 'MIS' : 'MIU',
            'Aksi',
        ];
    }, [id]);

    const searchPlaceholder = useMemo(() => {
        if (id === 'mib') return 'Cari No MIB atau material...';
        return 'Cari No MI, Ref PO, atau material...';
    }, [id]);

    return (
        <div className="rounded-xl border bg-card shadow-sm transition-shadow">
            <Collapsible open={open} onOpenChange={setOpen}>
                <div className="flex flex-row items-center justify-between gap-3 rounded-xl border bg-gradient-to-r from-slate-900/80 via-slate-800/70 to-slate-900/60 px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-3">
                        <CollapsibleTrigger className="group flex items-center gap-3 rounded-lg px-2 py-1 text-left transition-all hover:bg-white/5">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-transform group-data-[state=open]:rotate-180">
                                <ChevronDown className="h-4 w-4" />
                            </span>
                            <span className="text-base font-semibold text-white">
                                {label}
                            </span>
                        </CollapsibleTrigger>
                    </div>
                </div>
                <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                    <div className="p-4 pb-6">
                        <div className="space-y-3">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
                                    <Input
                                        value={search}
                                        onChange={(e) =>
                                            setSearch(e.target.value)
                                        }
                                        placeholder={searchPlaceholder}
                                        className="md:w-64"
                                    />
                                    {(id === 'mi' || id === 'mis') && (
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Select
                                                value={period}
                                                onValueChange={setPeriod}
                                            >
                                                <SelectTrigger className="w-36">
                                                    <SelectValue placeholder="Pilih Periode" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="today">
                                                        Hari Ini
                                                    </SelectItem>
                                                    <SelectItem value="this_week">
                                                        Minggu Ini
                                                    </SelectItem>
                                                    <SelectItem value="this_month">
                                                        Bulan Ini
                                                    </SelectItem>
                                                    <SelectItem value="this_year">
                                                        Tahun Ini
                                                    </SelectItem>
                                                    <SelectItem value="range">
                                                        Range Tanggal
                                                    </SelectItem>
                                                    <SelectItem value="all">
                                                        Semua Data
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>

                                            {period === 'range' && (
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="date"
                                                        value={startDate}
                                                        onChange={(e) =>
                                                            setStartDate(
                                                                e.target.value,
                                                            )
                                                        }
                                                        className="w-36"
                                                    />
                                                    <span className="text-muted-foreground">
                                                        -
                                                    </span>
                                                    <Input
                                                        type="date"
                                                        value={endDate}
                                                        onChange={(e) =>
                                                            setEndDate(
                                                                e.target.value,
                                                            )
                                                        }
                                                        className="w-36"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">
                                        Tampil
                                    </span>
                                    <Select
                                        value={String(pageSize)}
                                        onValueChange={(val) => {
                                            setPageSize(
                                                val === 'all'
                                                    ? 'all'
                                                    : Number(val),
                                            );
                                        }}
                                    >
                                        <SelectTrigger className="w-24">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="5">5</SelectItem>
                                            <SelectItem value="10">
                                                10
                                            </SelectItem>
                                            <SelectItem value="25">
                                                25
                                            </SelectItem>
                                            <SelectItem value="50">
                                                50
                                            </SelectItem>
                                            <SelectItem value="all">
                                                Semua
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="relative overflow-x-auto rounded-xl border bg-background/70 shadow-sm">
                                {loading && (
                                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
                                        <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm">
                                            <Loader2 className="h-4 w-4 animate-spin" />{' '}
                                            Memuat...
                                        </div>
                                    </div>
                                )}
                                <table className="min-w-full table-fixed border-collapse text-sm">
                                    <thead className="sticky top-0 z-[1] bg-background/95 text-xs text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-background/80">
                                        <tr>
                                            {columns.map((col, i, arr) => (
                                                <th
                                                    key={col}
                                                    className={`border-b px-3 py-2 font-semibold ${i === 0 ? 'rounded-tl-xl' : ''} ${i === arr.length - 1 ? 'rounded-tr-xl' : ''} ${col === 'Aksi' ? 'sticky right-0 z-[2] w-16 bg-background/95 text-center shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.6)]' : 'text-left'}`}
                                                >
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={columns.length}
                                                    className="px-3 py-8 text-center text-muted-foreground"
                                                >
                                                    {error ? (
                                                        <div className="mx-auto max-w-2xl">
                                                            <ErrorState
                                                                error={error}
                                                                onRetry={reload}
                                                            />
                                                        </div>
                                                    ) : (
                                                        'Tidak ada data.'
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                        {rows.map((row, idx) => (
                                            <tr
                                                key={`${id}-${row.id ?? row.no_doc ?? idx}-${idx}`}
                                                className="transition-colors odd:bg-muted/20 hover:bg-muted/40"
                                            >
                                                {id === 'mib' ? (
                                                    <>
                                                        <td className="border-b px-3 py-2 align-top font-medium whitespace-nowrap">
                                                            {row.no_doc}
                                                        </td>
                                                        <td className="border-b px-3 py-2 align-top">
                                                            {row.material}
                                                        </td>
                                                        <td className="border-b px-3 py-2 text-right align-top whitespace-nowrap tabular-nums">
                                                            {formatNumber(
                                                                row.qty,
                                                            )}
                                                        </td>
                                                        <td className="border-b px-3 py-2 align-top whitespace-nowrap">
                                                            {row.unit}
                                                        </td>
                                                        <td className="border-b px-3 py-2 text-right align-top whitespace-nowrap tabular-nums">
                                                            {formatNumber(
                                                                row.price,
                                                            )}
                                                        </td>
                                                        <td className="border-b px-3 py-2 text-right align-top whitespace-nowrap tabular-nums">
                                                            {formatNumber(
                                                                row.total_price,
                                                            )}
                                                        </td>
                                                        <td className="border-b px-3 py-2 text-right align-top whitespace-nowrap tabular-nums">
                                                            {formatNumber(
                                                                row.mib,
                                                            )}
                                                        </td>
                                                        <td className="border-b px-3 py-2 text-center align-top whitespace-nowrap">
                                                            {Number(row.qty) ===
                                                                Number(
                                                                    row.mib,
                                                                ) && (
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 text-muted-foreground hover:text-red-400"
                                                                    onClick={() =>
                                                                        handleDelete(
                                                                            row,
                                                                        )
                                                                    }
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="border-b px-3 py-2 align-top font-medium whitespace-nowrap">
                                                            {row.no_doc}
                                                        </td>
                                                        <td className="border-b px-3 py-2 align-top whitespace-nowrap">
                                                            {row.doc_tgl}
                                                        </td>
                                                        <td className="border-b px-3 py-2 align-top whitespace-nowrap">
                                                            {row.ref_po}
                                                        </td>
                                                        <td className="border-b px-3 py-2 align-top">
                                                            {row.material}
                                                        </td>
                                                        <td className="border-b px-3 py-2 text-right align-top whitespace-nowrap tabular-nums">
                                                            {formatNumber(
                                                                row.qty,
                                                            )}
                                                        </td>
                                                        <td className="border-b px-3 py-2 align-top whitespace-nowrap">
                                                            {row.unit}
                                                        </td>
                                                        <td className="border-b px-3 py-2 text-right align-top whitespace-nowrap tabular-nums">
                                                            {formatNumber(
                                                                row.price,
                                                            )}
                                                        </td>
                                                        <td className="border-b px-3 py-2 text-right align-top whitespace-nowrap tabular-nums">
                                                            {formatNumber(
                                                                row.total_price,
                                                            )}
                                                        </td>
                                                        <td className="border-b px-3 py-2 text-right align-top whitespace-nowrap tabular-nums">
                                                            {formatNumber(
                                                                id === 'mis'
                                                                    ? row.mis
                                                                    : row.miu,
                                                            )}
                                                        </td>
                                                        <td className="sticky right-0 border-b border-l bg-background/95 px-3 py-2 text-center align-top whitespace-nowrap shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.6)]">
                                                            {id === 'mi'
                                                                ? Number(
                                                                      row.inv ??
                                                                          0,
                                                                  ) === 0 && (
                                                                      <ActionIconButton
                                                                          label="Hapus"
                                                                          onClick={() =>
                                                                              handleDelete(
                                                                                  row,
                                                                              )
                                                                          }
                                                                      >
                                                                          <Trash2 className="h-4 w-4 text-destructive" />
                                                                      </ActionIconButton>
                                                                  )
                                                                : Number(
                                                                      row.qty,
                                                                  ) ===
                                                                      Number(
                                                                          row.mis,
                                                                      ) && (
                                                                      <ActionIconButton
                                                                          label="Hapus"
                                                                          onClick={() =>
                                                                              handleDelete(
                                                                                  row,
                                                                              )
                                                                          }
                                                                      >
                                                                          <Trash2 className="h-4 w-4 text-destructive" />
                                                                      </ActionIconButton>
                                                                  )}
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex flex-col items-start gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
                                <span>Total data: {formatNumber(total)}</span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={currentPage === 1 || loading}
                                        onClick={() =>
                                            setCurrentPage((p) =>
                                                Math.max(1, p - 1),
                                            )
                                        }
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span>
                                        Halaman {currentPage} / {totalPages}
                                    </span>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={
                                            currentPage >= totalPages || loading
                                        }
                                        onClick={() =>
                                            setCurrentPage((p) =>
                                                Math.min(totalPages, p + 1),
                                            )
                                        }
                                    >
                                        Berikutnya
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}

export default function DataMaterialPage() {
    return (
        <>
            <Head title="Data Material" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div>
                    <h1 className="text-xl font-semibold">Data Material</h1>
                    <p className="text-sm text-muted-foreground">
                        Ringkasan data material (MI, MIS, MIB)
                    </p>
                </div>

                <div className="space-y-4">
                    <SectionCollapse id="mi" label="Data MI" />
                    <SectionCollapse id="mis" label="Data MIS" />
                    <SectionCollapse id="mib" label="Data MIB" />
                </div>
            </div>
        </>
    );
}
DataMaterialPage.layout = (page) => (
    <AppLayout children={page} breadcrumbs={breadcrumbs} />
);