import AppLayout from '@/layouts/app-layout';
import { Head, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Search, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { ActionIconButton } from '@/components/action-icon-button';
import { ErrorState } from '@/components/data-states/ErrorState';
import { confirmDelete } from '@/lib/confirm-delete';
import { readApiError, normalizeApiError } from '@/lib/api-error';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Inventory', href: '/inventory/penerimaan-material' },
    { title: 'Penerimaan Material', href: '/inventory/penerimaan-material' },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

const formatNumber = (value) => {
    if (value === null || value === undefined || value === '') return '';
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(
        Number(value),
    );
};

export default function PenerimaanMaterialIndex() {
    const [mode, setMode] = useState(''); // mi | mis | mib

    const [headerByMode, setHeaderByMode] = useState(() => ({
        mi: { docDate: todayISO(), noPo: '', refPr: '', vendorName: '' },
        mis: { docDate: todayISO(), noPo: '', refPr: '', vendorName: '' },
        mib: { docDate: todayISO(), noPo: '', refPr: '', vendorName: '' },
    }));

    // Modal PO list (lazy)
    const [poModalOpen, setPoModalOpen] = useState(false);
    const [poLoading, setPoLoading] = useState(false);
    const [poError, setPoError] = useState(null);
    const [poRows, setPoRows] = useState([]);
    const [poTotal, setPoTotal] = useState(0);
    const [poSearch, setPoSearch] = useState('');
    const [poDebouncedSearch, setPoDebouncedSearch] = useState('');
    const [poPageSize, setPoPageSize] = useState(5);
    const [poPage, setPoPage] = useState(1);

    // Materials in selected PO (per mode)
    const [poMaterialsByMode, setPoMaterialsByMode] = useState(() => ({
        mi: { loading: false, rows: [] },
        mis: { loading: false, rows: [] },
        mib: { loading: false, rows: [] },
    }));
    const [poMaterialsErrorByMode, setPoMaterialsErrorByMode] = useState(() => ({
        mi: null,
        mis: null,
        mib: null,
    }));

    // Selected material fields (per mode)
    const [materialByMode, setMaterialByMode] = useState(() => ({
        mi: {
            kdMat: '',
            material: '',
            qtyInPo: '',
            qty: '',
            unit: '',
            price: '',
            lastPrice: '',
            totalPriceInPo: '',
            totalPrice: '',
            lastStock: '',
            stockNow: '',
        },
        mis: {
            kdMat: '',
            material: '',
            qtyInPo: '',
            qty: '',
            unit: '',
            price: '',
            lastPrice: '',
            totalPriceInPo: '',
            totalPrice: '',
            lastStock: '',
            stockNow: '',
        },
        mib: {
            kdMat: '',
            material: '',
            qtyInPo: '',
            qty: '',
            unit: '',
            price: '',
            lastPrice: '',
            remark: 'STOK',
            totalPriceInPo: '',
            totalPrice: '',
            lastStock: '',
            stockNow: '',
        },
    }));

    // Table Data Material (per mode)
    const [rowsByMode, setRowsByMode] = useState(() => ({
        mi: [],
        mis: [],
        mib: [],
    }));

    // Debounce PO search
    useEffect(() => {
        const handler = setTimeout(() => setPoDebouncedSearch(poSearch), 400);
        return () => clearTimeout(handler);
    }, [poSearch]);

    // Reset pagination when filters change
    useEffect(() => {
        setPoPage(1);
    }, [poDebouncedSearch, poPageSize]);

    // Load PO list when modal opens / filter changes (lazy)
    useEffect(() => {
        if (!poModalOpen) return;
        let cancelled = false;
        const load = async () => {
            setPoLoading(true);
            setPoError(null);
            try {
                const params = new URLSearchParams();
                params.set('search', poDebouncedSearch);
                params.set('page', String(poPage));
                params.set('pageSize', poPageSize === 'all' ? 'all' : String(poPageSize));
                const res = await fetch(
                    `/inventory/penerimaan-material/po-list?${params.toString()}`,
                    { headers: { Accept: 'application/json' } },
                );
                if (!res.ok) throw await readApiError(res);
                const data = await res.json();
                if (cancelled) return;
                setPoRows(Array.isArray(data?.rows) ? data.rows : []);
                setPoTotal(Number(data?.total ?? 0));
            } catch (err) {
                if (cancelled) return;
                setPoError(normalizeApiError(err, 'Gagal memuat data PO.'));
                setPoRows([]);
                setPoTotal(0);
            } finally {
                if (!cancelled) setPoLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [poModalOpen, poDebouncedSearch, poPageSize, poPage]);

    // Load materials for selected PO
    useEffect(() => {
        if (!mode) return;
        const currentNoPo = headerByMode?.[mode]?.noPo ?? '';
        if (!currentNoPo) {
            setPoMaterialsByMode((prev) => ({
                ...prev,
                [mode]: { ...prev[mode], rows: [] },
            }));
            return;
        }
        let cancelled = false;
        const load = async () => {
            setPoMaterialsByMode((prev) => ({
                ...prev,
                [mode]: { ...prev[mode], loading: true },
            }));
            setPoMaterialsErrorByMode((prev) => ({ ...prev, [mode]: null }));
            try {
                const params = new URLSearchParams({ no_po: currentNoPo });
                const res = await fetch(
                    `/inventory/penerimaan-material/po-materials?${params.toString()}`,
                    { headers: { Accept: 'application/json' } },
                );
                if (!res.ok) throw await readApiError(res);
                const data = await res.json();
                if (cancelled) return;
                setPoMaterialsByMode((prev) => ({
                    ...prev,
                    [mode]: {
                        ...prev[mode],
                        rows: Array.isArray(data?.rows) ? data.rows : [],
                    },
                }));
            } catch (err) {
                if (cancelled) return;
                setPoMaterialsErrorByMode((prev) => ({
                    ...prev,
                    [mode]: normalizeApiError(err, 'Gagal memuat material PO.'),
                }));
                setPoMaterialsByMode((prev) => ({
                    ...prev,
                    [mode]: { ...prev[mode], rows: [] },
                }));
            } finally {
                if (!cancelled) {
                    setPoMaterialsByMode((prev) => ({
                        ...prev,
                        [mode]: { ...prev[mode], loading: false },
                    }));
                }
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [mode, headerByMode]);

    const poTotalPages = useMemo(() => {
        if (poPageSize === 'all') return 1;
        const size = Number(poPageSize) || 5;
        return Math.max(1, Math.ceil(poTotal / size));
    }, [poPageSize, poTotal]);

    const computed = useMemo(() => {
        if (!mode) {
            return { totalInPo: 0, total: 0, stockNow: 0 };
        }
        const m = materialByMode?.[mode] ?? {};
        const qtyInPoNum = Number(m.qtyInPo) || 0;
        const qtyNum = Number(m.qty) || 0;
        const priceNum = Number(m.price) || 0;
        const lastStockNum = Number(m.lastStock) || 0;
        return {
            totalInPo: qtyInPoNum * priceNum,
            total: qtyNum * priceNum,
            stockNow: lastStockNum + qtyNum,
        };
    }, [mode, materialByMode]);

    useEffect(() => {
        if (!mode) return;
        setMaterialByMode((prev) => ({
            ...prev,
            [mode]: {
                ...prev[mode],
                totalPriceInPo: computed.totalInPo ? String(computed.totalInPo) : '',
                totalPrice: computed.total ? String(computed.total) : '',
                stockNow: String(computed.stockNow || ''),
            },
        }));
    }, [computed.totalInPo, computed.total, computed.stockNow]);

    const handlePickPo = (row) => {
        if (!mode) return;
        setHeaderByMode((prev) => ({
            ...prev,
            [mode]: {
                ...prev[mode],
                noPo: String(row?.no_po ?? ''),
                refPr: String(row?.ref_pr ?? ''),
                vendorName: String(row?.nm_vdr ?? ''),
            },
        }));
        setPoModalOpen(false);
    };

    const handlePickMaterial = (row) => {
        if (!mode) return;
        setMaterialByMode((prev) => ({
            ...prev,
            [mode]: {
                ...prev[mode],
                kdMat: String(row?.kd_mat ?? ''),
                material: String(row?.material ?? ''),
                qtyInPo: String(row?.qty ?? ''),
                qty: String(row?.qty ?? ''),
                unit: String(row?.unit ?? ''),
                price: String(row?.price ?? ''),
                lastPrice: String(row?.last_price ?? ''),
                lastStock: String(row?.last_stock ?? ''),
            },
        }));
    };

    const handleAddRow = () => {
        if (mode !== 'mi' && mode !== 'mis' && mode !== 'mib') return;
        const m = materialByMode?.[mode] ?? {};
        if (!m.kdMat || !m.material) return;

        // MI/MIS only: if PO price differs from last price (tb_material.harga), block. Item should go to MIB.
        if (mode === 'mi' || mode === 'mis') {
            const priceStr = String(m.price ?? '').trim();
            const lastPriceStr = String(m.lastPrice ?? '').trim();
            const priceNum = Number(priceStr);
            const lastPriceNum = Number(lastPriceStr);
            const bothNumeric = Number.isFinite(priceNum) && Number.isFinite(lastPriceNum);
            const isSame = bothNumeric ? priceNum === lastPriceNum : priceStr === lastPriceStr;
            if (!isSame) {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'warning',
                    title: 'Price dan Last Price tidak sama. Barang masuk MIB.',
                    showConfirmButton: false,
                    timer: 3000,
                    timerProgressBar: true,
                });
                return;
            }
        }

        const item = {
            kdMat: m.kdMat,
            material: m.material,
            qtyInPo: m.qtyInPo,
            qty: m.qty,
            unit: m.unit,
            // Keep raw price string (no rounding). Used for display & persisted as-is.
            priceRaw: m.price,
            lastPriceRaw: m.lastPrice,
            remark: mode === 'mib' ? String(m.remark ?? '') : undefined,
            totalPriceInPo: m.totalPriceInPo,
            totalPrice: m.totalPrice,
            lastStock: m.lastStock,
            stockNow: m.stockNow,
        };
        setRowsByMode((prev) => ({
            ...prev,
            [mode]: [...prev[mode], item],
        }));

        // Clear material input fields after add (header fields stay).
        setMaterialByMode((prev) => ({
            ...prev,
            [mode]: {
                ...prev[mode],
                kdMat: '',
                material: '',
                qtyInPo: '',
                qty: '',
                unit: '',
                price: '',
                lastPrice: '',
                ...(mode === 'mib' ? { remark: 'STOK' } : {}),
                totalPriceInPo: '',
                totalPrice: '',
                lastStock: '',
                stockNow: '',
            },
        }));
    };

    const removeMiRow = (idx) => {
        if (!mode) return;
        setRowsByMode((prev) => ({
            ...prev,
            [mode]: prev[mode].filter((_, i) => i !== idx),
        }));
    };

    const handleSaveMi = () => {
        if (mode !== 'mi') return;
        const header = headerByMode.mi;
        const rows = rowsByMode.mi;

        if (!header.noPo || rows.length === 0) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'warning',
                title: 'Pilih PO dan tambahkan minimal 1 material.',
                showConfirmButton: false,
                timer: 2500,
                timerProgressBar: true,
            });
            return;
        }

        const payloadRows = rows.map((r) => ({
            kd_mat: r.kdMat,
            material: r.material,
            qty: Number(r.qty) || 0,
            unit: r.unit,
            // Keep raw (no rounding); backend stores as-is.
            price: r.priceRaw,
            total_price: Number(r.totalPrice) || 0,
        }));

        router.post('/inventory/penerimaan-material/mi', {
            doc_date: header.docDate,
            no_po: header.noPo,
            ref_pr: header.refPr,
            vendor: header.vendorName,
            rows: payloadRows,
        });
    };

    const handleSaveMis = () => {
        if (mode !== 'mis') return;
        const header = headerByMode.mis;
        const rows = rowsByMode.mis;

        if (!header.noPo || rows.length === 0) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'warning',
                title: 'Pilih PO dan tambahkan minimal 1 material.',
                showConfirmButton: false,
                timer: 2500,
                timerProgressBar: true,
            });
            return;
        }

        const payloadRows = rows.map((r) => ({
            kd_mat: r.kdMat,
            material: r.material,
            qty: Number(r.qty) || 0,
            unit: r.unit,
            // Keep raw (no rounding); backend stores as-is.
            price: r.priceRaw,
            total_price: Number(r.totalPrice) || 0,
        }));

        router.post('/inventory/penerimaan-material/mis', {
            doc_date: header.docDate,
            no_po: header.noPo,
            ref_pr: header.refPr,
            vendor: header.vendorName,
            rows: payloadRows,
        });
    };

    const handleSaveMib = () => {
        if (mode !== 'mib') return;
        const header = headerByMode.mib;
        const rows = rowsByMode.mib;

        if (!header.noPo || rows.length === 0) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'warning',
                title: 'Pilih PO dan tambahkan minimal 1 material.',
                showConfirmButton: false,
                timer: 2500,
                timerProgressBar: true,
            });
            return;
        }

        const payloadRows = rows.map((r) => ({
            kd_mat: r.kdMat,
            material: r.material,
            qty: Number(r.qty) || 0,
            unit: r.unit,
            price: r.priceRaw,
            total_price: Number(r.totalPrice) || 0,
            remark: r.remark,
        }));

        router.post('/inventory/penerimaan-material/mib', {
            doc_date: header.docDate,
            no_po: header.noPo,
            ref_pr: header.refPr,
            vendor: header.vendorName,
            rows: payloadRows,
        });
    };

    const currentHeader = mode ? headerByMode[mode] : null;
    const currentMaterial = mode ? materialByMode[mode] : null;
    const currentPoMaterials = mode ? poMaterialsByMode[mode] : { loading: false, rows: [] };
    const currentPoMaterialsError = mode ? poMaterialsErrorByMode[mode] : null;
    const currentRows = mode ? rowsByMode[mode] : [];
    const modeLabel = mode === 'mis' ? 'MIS' : mode === 'mi' ? 'MI' : mode?.toUpperCase();

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Penerimaan Material" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Penerimaan Material</h1>
                        <p className="text-sm text-muted-foreground">
                            Terima material MI / MIS / MIB
                        </p>
                    </div>
                    <div className="w-full sm:w-64">
                        <Select value={mode} onValueChange={setMode}>
                            <SelectTrigger>
                                <SelectValue placeholder="Pilih penerimaan..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="mi">Terima Material MI</SelectItem>
                                <SelectItem value="mis">Terima Material MIS</SelectItem>
                                <SelectItem value="mib">Terima Material MIB</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {(mode === 'mi' || mode === 'mis' || mode === 'mib') && (
                    <>
                        <div
                            className={`rounded-2xl border p-4 shadow-sm ${
                                mode === 'mi'
                                    ? 'bg-card'
                                    : 'bg-gradient-to-br from-slate-950/40 via-slate-900/20 to-slate-950/30'
                            }`}
                        >
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <h2 className="text-base font-semibold">Input Material {modeLabel}</h2>
                                        <p className="text-xs text-muted-foreground">
                                            Pilih PO dulu, lalu pilih material dari tabel.
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        onClick={() => setPoModalOpen(true)}
                                        variant={mode === 'mi' ? 'outline' : 'default'}
                                        className="h-10 w-full gap-2 sm:w-auto"
                                    >
                                        <Search className="h-4 w-4" />
                                        Cari PO
                                    </Button>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-medium text-muted-foreground">
                                            No PO
                                        </label>
                                        <Input value={currentHeader?.noPo ?? ''} readOnly className="h-10" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-medium text-muted-foreground">
                                            Ref PR
                                        </label>
                                        <Input value={currentHeader?.refPr ?? ''} readOnly className="h-10" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-medium text-muted-foreground">
                                            Nama Vendor
                                        </label>
                                        <Input value={currentHeader?.vendorName ?? ''} readOnly className="h-10" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-medium text-muted-foreground">
                                            Date
                                        </label>
                                        <Input
                                            type="date"
                                            value={currentHeader?.docDate ?? todayISO()}
                                            onChange={(e) =>
                                                setHeaderByMode((prev) => ({
                                                    ...prev,
                                                    [mode]: { ...prev[mode], docDate: e.target.value },
                                                }))
                                            }
                                            className="h-10"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border bg-card p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <h2 className="text-base font-semibold">Data Material In PO</h2>
                                {currentPoMaterials.loading && (
                                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" /> Memuat...
                                    </span>
                                )}
                            </div>
                            {currentPoMaterialsError ? (
                                <div className="mb-3">
                                    <ErrorState
                                        error={currentPoMaterialsError}
                                        onRetry={() => {
                                            const currentNoPo = headerByMode?.[mode]?.noPo ?? '';
                                            if (!currentNoPo) return;
                                            setHeaderByMode((prev) => ({ ...prev }));
                                        }}
                                    />
                                </div>
                            ) : null}
                            <div className="max-h-[55vh] overflow-auto overscroll-contain rounded-xl border border-white/10">
                                <table className="min-w-full text-sm text-left">
                                    <thead className="sticky top-0 z-[1] bg-background/95 text-muted-foreground uppercase text-[11px] tracking-wide backdrop-blur supports-[backdrop-filter]:bg-background/80">
                                        <tr>
                                            <th className="border-b px-3 py-3">No</th>
                                            <th className="px-3 py-3">Kode Material</th>
                                            <th className="px-3 py-3">Material</th>
                                            <th className="px-3 py-3 text-right">Qty</th>
                                            <th className="px-3 py-3">Satuan</th>
                                            <th className="px-3 py-3 text-right">Price</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(!currentHeader?.noPo || currentPoMaterials.rows.length === 0) && (
                                            <tr>
                                                <td
                                                    colSpan={6}
                                                    className="px-3 py-4 text-center text-muted-foreground"
                                                >
                                                    {!currentHeader?.noPo ? 'Pilih PO terlebih dahulu.' : 'Tidak ada data.'}
                                                </td>
                                            </tr>
                                        )}
                                        {currentPoMaterials.rows.map((row, idx) => (
                                            <tr
                                                key={`${row.kd_mat ?? idx}-${idx}`}
                                                className="cursor-pointer border-t border-white/5 hover:bg-white/5"
                                                onClick={() => handlePickMaterial(row)}
                                            >
                                                <td className="px-3 py-2">{idx + 1}</td>
                                                <td className="px-3 py-2">{row.kd_mat}</td>
                                                <td className="px-3 py-2">{row.material}</td>
                                                <td className="px-3 py-2 text-right">{formatNumber(row.qty)}</td>
                                                <td className="px-3 py-2">{row.unit}</td>
                                                <td className="px-3 py-2 text-right">{formatNumber(row.price)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="rounded-xl border bg-card p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <h2 className="text-base font-semibold">Input Material {modeLabel}</h2>
                                <Button type="button" onClick={handleAddRow}>
                                    Tambah Data
                                </Button>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Kode Material</label>
                                    <Input value={currentMaterial?.kdMat ?? ''} readOnly />
                                </div>
                                <div className="space-y-1 lg:col-span-2">
                                    <label className="text-xs text-muted-foreground">Material</label>
                                    <Input value={currentMaterial?.material ?? ''} readOnly />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Qty In PO</label>
                                    <Input value={currentMaterial?.qtyInPo ?? ''} readOnly />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Qty</label>
                                    <Input
                                        value={currentMaterial?.qty ?? ''}
                                        onChange={(e) =>
                                            setMaterialByMode((prev) => ({
                                                ...prev,
                                                [mode]: { ...prev[mode], qty: e.target.value },
                                            }))
                                        }
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Satuan</label>
                                    <Input value={currentMaterial?.unit ?? ''} readOnly />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Price</label>
                                    <Input value={currentMaterial?.price ?? ''} readOnly />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Last Price</label>
                                    <Input value={currentMaterial?.lastPrice ?? ''} readOnly />
                                </div>
                                {mode === 'mib' && (
                                    <div className="space-y-1 lg:col-span-2">
                                        <label className="text-xs text-muted-foreground">Remark</label>
                                        <Input
                                            value={currentMaterial?.remark ?? ''}
                                            onChange={(e) =>
                                                setMaterialByMode((prev) => ({
                                                    ...prev,
                                                    mib: { ...prev.mib, remark: e.target.value },
                                                }))
                                            }
                                        />
                                    </div>
                                )}
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Total Price In PO</label>
                                    <Input value={formatNumber(currentMaterial?.totalPriceInPo)} readOnly />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Total Price</label>
                                    <Input value={formatNumber(currentMaterial?.totalPrice)} readOnly />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Last Stock</label>
                                    <Input value={formatNumber(currentMaterial?.lastStock)} readOnly />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Stock Now</label>
                                    <Input value={formatNumber(currentMaterial?.stockNow)} readOnly />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border bg-card p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <h2 className="text-base font-semibold">Data Material {modeLabel}</h2>
                                {mode === 'mi' ? (
                                    <Button type="button" onClick={handleSaveMi}>
                                        Simpan Data MI
                                    </Button>
                                ) : mode === 'mis' ? (
                                    <Button type="button" onClick={handleSaveMis}>
                                        Simpan Data MIS
                                    </Button>
                                ) : mode === 'mib' ? (
                                    <Button type="button" onClick={handleSaveMib}>
                                        Simpan Data MIB
                                    </Button>
                                ) : (
                                    <Button type="button">Simpan Data {modeLabel}</Button>
                                )}
                            </div>
                            <div className="max-h-[55vh] overflow-auto overscroll-contain rounded-xl border border-white/10">
                                <table className="min-w-full text-sm text-left">
                                    <thead className="sticky top-0 z-[1] bg-background/95 text-muted-foreground uppercase text-[11px] tracking-wide backdrop-blur supports-[backdrop-filter]:bg-background/80">
                                        <tr>
                                            <th className="px-3 py-3">No</th>
                                            <th className="px-3 py-3">Kode Material</th>
                                            <th className="px-3 py-3">Material</th>
                                            <th className="px-3 py-3">Qty In PO</th>
                                            <th className="px-3 py-3">Qty</th>
                                            <th className="px-3 py-3">Satuan</th>
                                            <th className="px-3 py-3 text-right">Price</th>
                                            <th className="px-3 py-3">Total Price In PO</th>
                                            <th className="px-3 py-3">Total Price</th>
                                            <th className="px-3 py-3">Last Stock</th>
                                            <th className="px-3 py-3">Stock Now</th>
                                            {mode === 'mib' && <th className="px-3 py-3">Remark</th>}
                                            <th className="sticky right-0 z-[2] border-b border-l bg-background/95 px-3 py-3 text-center shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.6)]">
                                                Aksi
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentRows.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={mode === 'mib' ? 13 : 12}
                                                    className="px-3 py-4 text-center text-muted-foreground"
                                                >
                                                    Belum ada data.
                                                </td>
                                            </tr>
                                        )}
                                        {currentRows.map((r, idx) => (
                                            <tr
                                                key={`${r.kdMat}-${idx}`}
                                                className="border-t border-white/5"
                                            >
                                                <td className="px-3 py-2">{idx + 1}</td>
                                                <td className="px-3 py-2">{r.kdMat}</td>
                                                <td className="px-3 py-2">{r.material}</td>
                                                <td className="px-3 py-2">{formatNumber(r.qtyInPo)}</td>
                                                <td className="px-3 py-2">{formatNumber(r.qty)}</td>
                                                <td className="px-3 py-2">{r.unit}</td>
                                                <td className="px-3 py-2 text-right">{r.priceRaw}</td>
                                                <td className="px-3 py-2">{formatNumber(r.totalPriceInPo)}</td>
                                                <td className="px-3 py-2">{formatNumber(r.totalPrice)}</td>
                                                <td className="px-3 py-2">{formatNumber(r.lastStock)}</td>
                                                <td className="px-3 py-2">{formatNumber(r.stockNow)}</td>
                                                {mode === 'mib' && <td className="px-3 py-2">{r.remark}</td>}
                                                <td className="sticky right-0 border-b border-l bg-background/95 px-3 py-2 text-center shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.6)]">
                                                    <ActionIconButton
                                                        label="Hapus"
                                                        onClick={async () => {
                                                            const ok = await confirmDelete({
                                                                title: 'Hapus baris?',
                                                                text: 'Baris material ini akan dihapus dari draft input.',
                                                            });
                                                            if (!ok) return;
                                                            removeMiRow(idx);
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </ActionIconButton>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {!mode && (
                    <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
                        Pilih jenis penerimaan material dulu untuk menampilkan form.
                    </div>
                )}
                {mode && mode !== 'mi' && mode !== 'mis' && mode !== 'mib' && (
                    <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
                        Form untuk {mode.toUpperCase()} belum dibuat.
                    </div>
                )}

                <Dialog open={poModalOpen} onOpenChange={setPoModalOpen}>
                    <DialogContent className="flex h-[100dvh] w-[100dvw] max-w-none flex-col overflow-hidden rounded-none p-0 sm:h-[85vh] sm:w-[95vw] sm:max-w-5xl sm:rounded-xl">
                        <DialogHeader className="shrink-0 border-b bg-background/80 px-4 py-3 backdrop-blur">
                            <DialogTitle className="text-base">Cari PO</DialogTitle>
                        </DialogHeader>
                        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <Input
                                    value={poSearch}
                                    onChange={(e) => setPoSearch(e.target.value)}
                                    placeholder="Cari No PO, Ref PR, Nama Vendor..."
                                    className="sm:max-w-md"
                                />
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">Tampil</span>
                                    <Select
                                        value={String(poPageSize)}
                                        onValueChange={(val) =>
                                            setPoPageSize(val === 'all' ? 'all' : Number(val))
                                        }
                                    >
                                        <SelectTrigger className="w-24">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="5">5</SelectItem>
                                            <SelectItem value="10">10</SelectItem>
                                            <SelectItem value="25">25</SelectItem>
                                            <SelectItem value="50">50</SelectItem>
                                            <SelectItem value="all">Semua</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border bg-background/60">
                                {poLoading && (
                                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
                                        <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm">
                                            <Loader2 className="h-4 w-4 animate-spin" /> Memuat...
                                        </div>
                                    </div>
                                )}
                                <div className="h-full overflow-auto overscroll-contain">
                                    <table className="min-w-full text-sm text-left">
                                        <thead className="sticky top-0 z-[1] bg-background/95 text-xs text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-background/80">
                                            <tr>
                                                <th className="border-b px-3 py-2 font-semibold">No PO</th>
                                                <th className="border-b px-3 py-2 font-semibold">Ref PR</th>
                                                <th className="border-b px-3 py-2 font-semibold">Nama Vendor</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {poRows.length === 0 && !poLoading && (
                                                <tr>
                                                    <td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">
                                                        {poError ? (
                                                            <div className="mx-auto max-w-2xl">
                                                                <ErrorState error={poError} />
                                                            </div>
                                                        ) : (
                                                            'Tidak ada data.'
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                            {poRows.map((row, idx) => (
                                                <tr
                                                    key={`${row.no_po ?? idx}-${idx}`}
                                                    className="cursor-pointer border-b last:border-b-0 hover:bg-muted/40"
                                                    onClick={() => handlePickPo(row)}
                                                >
                                                    <td className="px-3 py-2 font-medium">{row.no_po}</td>
                                                    <td className="px-3 py-2">{row.ref_pr}</td>
                                                    <td className="px-3 py-2">{row.nm_vdr}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="shrink-0 flex flex-col items-start justify-between gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center">
                                <span>Total data: {formatNumber(poTotal)}</span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={poPage === 1 || poLoading}
                                        onClick={() => setPoPage((p) => Math.max(1, p - 1))}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <span>
                                        Halaman {poPage} / {poTotalPages}
                                    </span>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={poPage >= poTotalPages || poLoading}
                                        onClick={() => setPoPage((p) => Math.min(poTotalPages, p + 1))}
                                    >
                                        Berikutnya
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
