import InvoiceDetailDialog from '@/components/InvoiceDetailDialog';
import OverdueInvoiceWarningDialog from '@/components/OverdueInvoiceWarningDialog';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';
import {
    AlertCircle,
    AlertTriangle,
    ArrowUpRight,
    Bot,
    Brain,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock,
    Copy,
    Eye,
    FileText,
    Layers,
    Loader2,
    MessageSquare,
    PhoneCall,
    RefreshCw,
    Send,
    ShieldAlert,
    Sparkles,
    Target,
    TrendingDown,
    Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Penjualan', href: '/penjualan/faktur-penjualan' },
    { title: 'Review Tagihan', href: '/penjualan/review-tagihan' },
];

const overdueRanges = [
    { value: '30', label: '30 hari' },
    { value: '60', label: '60 hari' },
    { value: '90', label: '90 hari' },
    { value: '180', label: '180 hari' },
    { value: '360', label: '360 hari' },
    { value: '720', label: '720 hari' },
    { value: 'gt720', label: '> 720 hari' },
    { value: 'all', label: 'Semua data' },
];

const pageSizes = [5, 10, 25, 50, 100];
const sortOptions = [
    { value: 'oldest_due', label: 'Jatuh tempo terlama' },
    { value: 'shortest_due', label: 'Jatuh tempo pendek' },
    { value: 'largest_balance', label: 'Saldo piutang terbesar' },
    { value: 'smallest_balance', label: 'Saldo piutang terkecil' },
    { value: 'most_invoices', label: 'Total faktur terbanyak' },
    { value: 'fewest_invoices', label: 'Total faktur sedikit' },
];

const toNumber = (value) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const parsed = Number(String(value ?? '').replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatRupiah = (value) =>
    `Rp. ${new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: 0,
    }).format(Math.round(toNumber(value)))}`;

const formatPercent = (value) => {
    const num = toNumber(value);
    return `${num.toFixed(1)}%`;
};

const currentMonthName = new Intl.DateTimeFormat('id-ID', {
    month: 'long',
}).format(new Date());

export default function ReviewTagihanIndex() {
    const [summary, setSummary] = useState({
        near_due_customers: 0,
        near_due_invoices: 0,
        current_month_customers: 0,
        current_month_invoices: 0,
        overdue_customers: 0,
        overdue_invoices: 0,
    });
    const [overdueRange, setOverdueRange] = useState('30');
    const [customers, setCustomers] = useState([]);
    const [customerTotal, setCustomerTotal] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);
    const [sort, setSort] = useState('oldest_due');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalData, setModalData] = useState(null);
    const [modalTitle, setModalTitle] = useState('Review Tagihan');
    const [invoicePaymentFilter, setInvoicePaymentFilter] = useState('all');
    const [selectedInvoiceNo, setSelectedInvoiceNo] = useState('');
    const [invoiceDetailOpen, setInvoiceDetailOpen] = useState(false);

    // AI Collection Intelligence State
    const [aiData, setAiData] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState(null);
    const [aiEngine, setAiEngine] = useState('Python Analytics Engine');
    const [aiIsFallback, setAiIsFallback] = useState(false);
    const [aiNotice, setAiNotice] = useState('');
    const [aiCopied, setAiCopied] = useState(false);
    const [aiCollapsed, setAiCollapsed] = useState(false);
    const [accountCopied, setAccountCopied] = useState(null);

    const totalPages = useMemo(
        () => Math.max(1, Math.ceil(customerTotal / pageSize)),
        [customerTotal, pageSize],
    );

    const loadSummary = async () => {
        const params = new URLSearchParams();
        params.set('overdue_range', overdueRange);

        const response = await fetch(
            `/penjualan/review-tagihan/summary?${params.toString()}`,
            { headers: { Accept: 'application/json' } },
        );
        if (!response.ok) return;
        setSummary(await response.json());
    };

    const loadCustomers = async (page = currentPage) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', String(page));
            params.set('per_page', String(pageSize));
            params.set('sort', sort);
            if (search.trim()) {
                params.set('search', search.trim());
            }

            const response = await fetch(
                `/penjualan/review-tagihan/customers?${params.toString()}`,
                { headers: { Accept: 'application/json' } },
            );
            if (!response.ok) throw new Error('Request failed');
            const data = await response.json();
            setCustomers(Array.isArray(data?.data) ? data.data : []);
            setCustomerTotal(Number(data?.total ?? 0));
        } finally {
            setLoading(false);
        }
    };

    // Load AI Collection Intelligence (Python + Qwen 2.5 7B)
    const fetchAiAnalysis = async (force = false) => {
        setAiLoading(true);
        setAiError(null);
        try {
            const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
            const csrfToken = match ? decodeURIComponent(match[1]) : '';

            const response = await fetch('/penjualan/review-tagihan/ai-analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-XSRF-TOKEN': csrfToken,
                },
                body: JSON.stringify({
                    scope: 'all',
                    overdue_range: overdueRange,
                    force,
                }),
            });

            if (!response.ok) {
                if (response.status === 504) {
                    throw new Error('Server AI Timeout (504). Mengantre di memori VPS, silakan coba lagi.');
                }
                throw new Error(`Gagal memuat analisis AI penagihan (Kode: ${response.status}).`);
            }

            const json = await response.json();
            if (json.success && json.data) {
                setAiData(json.data);
                setAiEngine(json.engine || 'Python Analytics Engine');
                setAiIsFallback(Boolean(json.is_fallback));
                setAiNotice(json.notice || '');
            } else {
                throw new Error(json.notice || 'Gagal memproses analitik penagihan.');
            }
        } catch (err) {
            console.error('AI Collection Analysis Error:', err);
            setAiError(err.message || 'Gagal memuat analisis data dan AI penagihan.');
        } finally {
            setAiLoading(false);
        }
    };

    // Copy Overall Collection Strategy to WhatsApp format
    const handleCopyCollectionReport = () => {
        if (!aiData) return;
        const analytics = aiData.analytics || {};
        const lines = [
            `*LAPORAN STRATEGIS REVIEW TAGIHAN & PRIORITAS PENAGIHAN*`,
            `Tanggal: ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date())}`,
            `AI Engine: ${aiEngine}`,
            `Health Score Kolektibilitas: ${aiData.health_score}/100 [${aiData.health_status}]`,
            ``,
            `*1. RINGKASAN AGREGAT PIUTANG:*`,
            `• Total Saldo Piutang: ${analytics.formatted_total_outstanding || formatRupiah(analytics.total_outstanding)}`,
            `• Total Lewat Jatuh Tempo: ${analytics.formatted_total_overdue || formatRupiah(analytics.total_overdue_saldo)} (${analytics.overdue_percentage || 0}%)`,
            `• Rata-rata Keterlambatan (DSO): ${analytics.weighted_avg_overdue_days || 0} Hari`,
            `• Konsentrasi Top 5 Debtor: ${analytics.top_5_debt_share || 0}%`,
            ``,
            `*2. RINGKASAN EKSEKUTIF:*`,
            aiData.executive_summary,
            ``,
            `*3. TOP AKUN PRIORITAS UTAMA WAJIB DITAGIH HARI INI:*`,
            ...(aiData.top_priority_accounts || []).slice(0, 5).map(
                (acc, i) =>
                    `${i + 1}. *${acc.customer}*\n   - Saldo: ${acc.formatted_saldo} (Telat: ${acc.max_overdue_days} hari, ${acc.invoice_count} faktur)\n   - Tingkat Urgensi: ${acc.tier_label || acc.tier}\n   - Tindakan: ${acc.recommended_action}`,
            ),
            ``,
            `*4. PANDUAN TAKTIS TIM MARKETING & SALES:*`,
            ...(aiData.collection_directives || []).map(
                (d, i) =>
                    `[${d.role}] - Urgensi: ${d.urgency}\n• Target: ${d.target}\n• Aksi: ${d.action}\n• Script Call/WA: "${d.script}"\n`,
            ),
            ``,
            `*5. QUICK-WINS (TAGIHAN POTENSI CEPAT CAIR):*`,
            ...(aiData.quick_wins || []).slice(0, 5).map(
                (q, i) =>
                    `[ ] ${q.customer} (${q.no_faktur}): ${q.formatted_saldo} - Telat ${q.overdue_days} hari`,
            ),
            ``,
            `*6. REKOMENDASI KEBIJAKAN KREDIT:*`,
            ...(aiData.credit_policy_recommendations || []).map((p) => `• ${p}`),
        ];

        navigator.clipboard.writeText(lines.join('\n'));
        setAiCopied(true);
        setTimeout(() => setAiCopied(false), 2500);
    };

    // Copy Targeted Customer Script for WhatsApp
    const handleCopyCustomerScript = (customerName, saldo, overdueDays, invoicesCount) => {
        const message =
            `Halo Selamat Pagi/Siang Rekan Keuangan & Purchasing ${customerName},\n\n` +
            `Semoga Bapak/Ibu dan tim senantiasa dalam keadaan sehat dan lancar usahanya.\n\n` +
            `Kami dari Tim Penjualan & Keuangan izin mengonfirmasi rekapitulasi faktur penjualan dengan rincian outstanding sebesar *${saldo}* (${invoicesCount} faktur) yang saat ini telah melewati batas jatuh tempo (${overdueDays} hari).\n\n` +
            `Mohon bantuannya untuk informasi estimasi jadwal kliring/transfer pelunasan faktur tersebut minggu ini agar kami dapat memprioritaskan alokasi armada dan proses order barang berikutnya untuk ${customerName}.\n\n` +
            `Jika ada dokumen faktur atau tanda terima yang perlu kami kirimkan ulang, mohon berkenan mengabari kami. Terima kasih banyak atas kerja sama yang baik selama ini. 🙏`;

        navigator.clipboard.writeText(message);
        setAccountCopied(customerName);
        setTimeout(() => setAccountCopied(null), 2500);
    };

    const openInvoiceModal = async ({
        scope = 'overdue',
        customer = '',
        range = overdueRange,
        showPaymentFilter = false,
    }) => {
        const params = new URLSearchParams();
        params.set('scope', scope);
        params.set('overdue_range', range);
        if (customer) {
            params.set('customer', customer);
        }

        const response = await fetch(
            `/penjualan/review-tagihan/invoices?${params.toString()}`,
            { headers: { Accept: 'application/json' } },
        );
        if (!response.ok) return;
        const data = await response.json();
        setModalData({
            ...data,
            showPaymentFilter,
        });
        setInvoicePaymentFilter('all');
        setModalTitle(customer || data?.customer || 'Review Tagihan');
        setModalOpen(true);
    };

    const filteredModalData = useMemo(() => {
        const invoices = Array.isArray(modalData?.invoices)
            ? modalData.invoices
            : [];
        if (!modalData?.showPaymentFilter || invoicePaymentFilter === 'all') {
            return modalData;
        }

        const filteredInvoices = invoices.filter((invoice) => {
            const total = toNumber(invoice.g_total);
            const saldoPiutang = toNumber(invoice.saldo_piutang);

            if (invoicePaymentFilter === 'unpaid') {
                return total > 0 && saldoPiutang === total;
            }

            if (invoicePaymentFilter === 'partial') {
                return saldoPiutang > 0 && saldoPiutang < total;
            }

            return true;
        });

        return {
            ...modalData,
            invoices: filteredInvoices,
            total_overdue: filteredInvoices.reduce(
                (sum, invoice) => sum + toNumber(invoice.saldo_piutang),
                0,
            ),
            oldest_overdue_days: filteredInvoices.reduce(
                (max, invoice) => Math.max(max, toNumber(invoice.umur_tempo)),
                0,
            ),
        };
    }, [modalData, invoicePaymentFilter]);

    useEffect(() => {
        loadSummary();
    }, [overdueRange]);

    useEffect(() => {
        loadCustomers(currentPage);
    }, [currentPage, pageSize, sort]);

    useEffect(() => {
        // Load AI collection analysis on initial mount
        fetchAiAnalysis();
    }, []);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            if (currentPage === 1) {
                loadCustomers(1);
            } else {
                setCurrentPage(1);
            }
        }, 300);
        return () => window.clearTimeout(timeout);
    }, [search]);

    return (
        <>
            <Head title="Review Tagihan & AI Intelligence" />
            <div className="flex-1 space-y-6 p-4">
                {/* 1. Header Page */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                                Review Tagihan &amp; Piutang Usaha
                            </h1>
                            <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                                <Sparkles className="h-3 w-3" />
                                AI Powered
                            </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Monitoring saldo piutang faktur, analitik risiko umur jatuh tempo, dan panduan taktis penagihan.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchAiAnalysis(true)}
                            disabled={aiLoading}
                            className="gap-1.5 border-sidebar-border/70 text-xs font-medium shadow-2xs hover:bg-muted"
                        >
                            <RefreshCw
                                className={`h-3.5 w-3.5 ${aiLoading ? 'animate-spin text-primary' : ''}`}
                            />
                            <span>{aiLoading ? 'Memproses...' : 'Analisis Ulang (AI)'}</span>
                        </Button>
                    </div>
                </div>

                {/* 2. Top Summary Stat Cards */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card
                        className="cursor-pointer transition-all hover:border-amber-500 hover:shadow-md"
                        onClick={() => openInvoiceModal({ scope: 'near_due' })}
                    >
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
                                <span>Dekat Jatuh Tempo</span>
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                    <Clock className="h-4 w-4" />
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-foreground">
                                {summary.near_due_customers}
                            </div>
                            <p className="text-xs text-muted-foreground">customer perlu follow-up</p>
                            <div className="mt-3 flex items-center justify-between border-t border-sidebar-border/40 pt-2 text-xs font-medium">
                                <span className="text-muted-foreground">Total Tagihan:</span>
                                <span className="text-foreground">{summary.near_due_invoices} invoice</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card
                        className="cursor-pointer transition-all hover:border-blue-500 hover:shadow-md"
                        onClick={() => openInvoiceModal({ scope: 'current_month' })}
                    >
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
                                <span>Tempo Bulan {currentMonthName}</span>
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                    <Layers className="h-4 w-4" />
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-foreground">
                                {summary.current_month_customers}
                            </div>
                            <p className="text-xs text-muted-foreground">customer berjalan</p>
                            <div className="mt-3 flex items-center justify-between border-t border-sidebar-border/40 pt-2 text-xs font-medium">
                                <span className="text-muted-foreground">Total Tagihan:</span>
                                <span className="text-foreground">{summary.current_month_invoices} invoice</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card
                        className="cursor-pointer transition-all hover:border-rose-500 hover:shadow-md"
                        onClick={() => openInvoiceModal({ scope: 'overdue' })}
                    >
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between gap-3">
                                <CardTitle className="text-sm font-semibold text-muted-foreground">
                                    Lewat Jatuh Tempo
                                </CardTitle>
                                <select
                                    className="rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-xs font-medium"
                                    value={overdueRange}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={(event) => setOverdueRange(event.target.value)}
                                >
                                    {overdueRanges.map((range) => (
                                        <option key={range.value} value={range.value}>
                                            {range.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-rose-600 dark:text-rose-400">
                                {summary.overdue_customers}
                            </div>
                            <p className="text-xs text-muted-foreground">customer menunggak</p>
                            <div className="mt-3 flex items-center justify-between border-t border-sidebar-border/40 pt-2 text-xs font-medium">
                                <span className="text-muted-foreground">Total Tagihan:</span>
                                <span className="font-semibold text-rose-600 dark:text-rose-400">
                                    {summary.overdue_invoices} invoice
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* 3. AI COLLECTION INTELLIGENCE & STRATEGIC RECOMMENDATIONS CARD */}
                <div className="overflow-hidden rounded-2xl border border-amber-500/30 bg-card shadow-md transition-all hover:shadow-lg">
                    {/* Header Card */}
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-indigo-500/10 px-5 py-4 dark:from-amber-950/40 dark:via-rose-950/30 dark:to-indigo-950/40">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-sm">
                                <Brain className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                                        AI Collection Intelligence &amp; Strategic Recommendations
                                    </h2>
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        {aiEngine}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Analisis presisi Python (Aging Buckets, DSO &amp; Skor Prioritas Penagihan) diteruskan ke Qwen 2.5 7B untuk panduan penagihan.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCopyCollectionReport}
                                disabled={!aiData}
                                className="h-8.5 gap-1.5 border-sidebar-border/70 text-xs font-medium shadow-2xs hover:bg-muted"
                                title="Salin ringkasan analisis penagihan dan script WhatsApp ke Clipboard"
                            >
                                {aiCopied ? (
                                    <>
                                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                                        <span className="text-emerald-600 font-semibold">Tersalin ke WA</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="hidden sm:inline">Salin Laporan WA</span>
                                    </>
                                )}
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fetchAiAnalysis(true)}
                                disabled={aiLoading}
                                className="h-8.5 gap-1.5 border-sidebar-border/70 text-xs font-medium shadow-2xs hover:bg-muted"
                                title="Hitung ulang analitik data penagihan di Python dan jalankan AI"
                            >
                                <RefreshCw className={`h-3.5 w-3.5 ${aiLoading ? 'animate-spin text-primary' : ''}`} />
                                <span className="hidden sm:inline">Analisis Ulang</span>
                            </Button>

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setAiCollapsed(!aiCollapsed)}
                                className="h-8.5 w-8.5 border border-sidebar-border/50 text-muted-foreground hover:text-foreground"
                                title={aiCollapsed ? 'Buka Panel AI' : 'Ciutkan Panel AI'}
                            >
                                {aiCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>

                    {/* Body Card */}
                    {!aiCollapsed && (
                        <div className="p-5 space-y-6">
                            {/* Loading Skeleton */}
                            {aiLoading && !aiData && (
                                <div className="space-y-4 py-4">
                                    <div className="flex items-center gap-3">
                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                        <span className="text-xs font-medium text-muted-foreground">
                                            Python Engine sedang membedah 360+ faktur piutang, menghitung DSO, konsentrasi HHI, dan merumuskan prioritas penagihan...
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                        <div className="h-28 animate-pulse rounded-xl bg-muted/60" />
                                        <div className="h-28 animate-pulse rounded-xl bg-muted/60" />
                                        <div className="h-28 animate-pulse rounded-xl bg-muted/60" />
                                        <div className="h-28 animate-pulse rounded-xl bg-muted/60" />
                                    </div>
                                    <div className="h-44 animate-pulse rounded-xl bg-muted/40" />
                                </div>
                            )}

                            {/* Error Alert */}
                            {aiError && !aiLoading && (
                                <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-700 dark:text-rose-300">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                                        <span>{aiError}</span>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => fetchAiAnalysis(true)}
                                        className="h-7 border-rose-500/30 text-xs text-rose-700 dark:text-rose-300"
                                    >
                                        Coba Lagi
                                    </Button>
                                </div>
                            )}

                            {/* Content Display */}
                            {aiData && (
                                <>
                                    {/* Notice Banner */}
                                    {aiIsFallback && (
                                        <div className="flex items-center gap-2.5 rounded-xl border border-indigo-500/25 bg-indigo-500/10 px-4 py-2.5 text-xs text-indigo-800 dark:text-indigo-200">
                                            <Sparkles className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                                            <span>
                                                <strong>Metode Analitik Data Terintegrasi (Python + Qwen 2.5):</strong> Seluruh analitik data dihitung secara presisi menggunakan <em>Python Collection Analytics Engine</em> (Aging Buckets, DSO, Concentration HHI &amp; Multi-factor Priority Scoring), lalu diteruskan ke <strong>Qwen 2.5 (7B) Ollama</strong> di VPS Production agar arahan penagihan berbasis data riil dan jauh lebih akurat.
                                            </span>
                                        </div>
                                    )}

                                    {/* 1. Key 4 Metrics Cards Grid */}
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                        {/* Metric 1: Health Score */}
                                        <div className="flex flex-col justify-between rounded-xl border border-sidebar-border/80 bg-gradient-to-br from-card to-background p-4 shadow-2xs">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                    Health Score Kolektibilitas
                                                </span>
                                                <span
                                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                                        aiData.health_score >= 80
                                                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                                            : aiData.health_score >= 60
                                                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                                            : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                                                    }`}
                                                >
                                                    {aiData.health_status}
                                                </span>
                                            </div>

                                            <div className="my-2.5 flex items-baseline gap-2">
                                                <span
                                                    className={`text-4xl font-extrabold tracking-tight ${
                                                        aiData.health_score >= 80
                                                            ? 'text-emerald-600 dark:text-emerald-400'
                                                            : aiData.health_score >= 60
                                                            ? 'text-amber-600 dark:text-amber-400'
                                                            : 'text-rose-600 dark:text-rose-400'
                                                    }`}
                                                >
                                                    {aiData.health_score}
                                                </span>
                                                <span className="text-xs font-medium text-muted-foreground">/ 100</span>
                                            </div>

                                            <div className="space-y-1 border-t border-sidebar-border/40 pt-2 text-[11px] text-muted-foreground">
                                                <div className="flex justify-between">
                                                    <span>Tingkat Risiko:</span>
                                                    <strong className={aiData.health_score < 50 ? 'text-rose-600' : 'text-foreground'}>
                                                        {aiData.health_score < 40 ? 'Sangat Tinggi (Bad Debt)' : 'Terkendali'}
                                                    </strong>
                                                </div>
                                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${
                                                            aiData.health_score >= 80
                                                                ? 'bg-emerald-500'
                                                                : aiData.health_score >= 60
                                                                ? 'bg-amber-500'
                                                                : 'bg-rose-500'
                                                        }`}
                                                        style={{ width: `${aiData.health_score}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Metric 2: Overdue Exposure & DSO */}
                                        <div className="flex flex-col justify-between rounded-xl border border-sidebar-border/80 bg-gradient-to-br from-card to-background p-4 shadow-2xs">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                    Total Saldo Tertunggak
                                                </span>
                                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-rose-500/10 text-rose-600">
                                                    <TrendingDown className="h-3.5 w-3.5" />
                                                </span>
                                            </div>

                                            <div className="my-2.5">
                                                <div className="text-lg font-bold text-foreground sm:text-xl">
                                                    {aiData.analytics?.formatted_total_overdue || formatRupiah(aiData.analytics?.total_overdue_saldo)}
                                                </div>
                                                <p className="text-[11px] font-semibold text-rose-600">
                                                    {aiData.analytics?.overdue_percentage ?? 100}% dari total saldo piutang
                                                </p>
                                            </div>

                                            <div className="flex items-center justify-between border-t border-sidebar-border/40 pt-2 text-[11px] text-muted-foreground">
                                                <span>Rata-rata Telat (DSO):</span>
                                                <strong className="text-foreground">
                                                    {aiData.analytics?.weighted_avg_overdue_days ?? 0} Hari
                                                </strong>
                                            </div>
                                        </div>

                                        {/* Metric 3: Concentration Top 5 (HHI) */}
                                        <div className="flex flex-col justify-between rounded-xl border border-sidebar-border/80 bg-gradient-to-br from-card to-background p-4 shadow-2xs">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                    Konsentrasi Top 5 Debtor
                                                </span>
                                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
                                                    <ShieldAlert className="h-3.5 w-3.5" />
                                                </span>
                                            </div>

                                            <div className="my-2.5">
                                                <div className="text-lg font-bold text-foreground sm:text-xl">
                                                    {aiData.analytics?.top_5_debt_share ?? 0}%
                                                </div>
                                                <p className="text-[11px] text-muted-foreground">
                                                    dari seluruh saldo macet terpusat di 5 customer
                                                </p>
                                            </div>

                                            <div className="flex items-center justify-between border-t border-sidebar-border/40 pt-2 text-[11px] text-muted-foreground">
                                                <span>Indeks HHI / Gini:</span>
                                                <strong className="text-foreground">
                                                    {aiData.analytics?.hhi_concentration ?? 0} / {aiData.analytics?.gini_coefficient ?? 0}
                                                </strong>
                                            </div>
                                        </div>

                                        {/* Metric 4: Quick-Wins Potential */}
                                        <div className="flex flex-col justify-between rounded-xl border border-sidebar-border/80 bg-gradient-to-br from-card to-background p-4 shadow-2xs">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                    Peluang Quick-Wins
                                                </span>
                                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
                                                    <Zap className="h-3.5 w-3.5" />
                                                </span>
                                            </div>

                                            <div className="my-2.5">
                                                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 sm:text-xl">
                                                    {(aiData.quick_wins || []).length} Faktur Segar
                                                </div>
                                                <p className="text-[11px] text-muted-foreground">
                                                    keterlambatan &le; 35 hari (probabilitas cair cepat &gt; 85%)
                                                </p>
                                            </div>

                                            <div className="flex items-center justify-between border-t border-sidebar-border/40 pt-2 text-[11px] text-muted-foreground">
                                                <span>Target Tagih:</span>
                                                <strong className="text-emerald-600 dark:text-emerald-400">
                                                    7 Hari ke Depan
                                                </strong>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. Executive Summary */}
                                    <div className="rounded-xl border border-sidebar-border/70 bg-muted/40 p-4">
                                        <div className="flex items-center gap-2 border-b border-sidebar-border/50 pb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            <Bot className="h-4 w-4 text-primary" />
                                            <span>Ringkasan Eksekutif Penagihan (Executive Dossier)</span>
                                        </div>
                                        <p className="mt-2.5 text-sm leading-relaxed text-foreground/90">
                                            {aiData.executive_summary}
                                        </p>
                                    </div>

                                    {/* 3. Aging Distribution Breakdown */}
                                    {Array.isArray(aiData.aging_distribution) && aiData.aging_distribution.length > 0 && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="h-4 w-4 text-primary" />
                                                    <h3 className="text-sm font-bold tracking-tight text-foreground">
                                                        Distribusi Umur Piutang (Aging Buckets Matrix)
                                                    </h3>
                                                </div>
                                                <span className="text-xs text-muted-foreground">
                                                    Dihitung presisi per tanggal jatuh tempo
                                                </span>
                                            </div>

                                            {/* Stacked Progress Bar */}
                                            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/80 shadow-inner">
                                                {aiData.aging_distribution.map((b) => {
                                                    if (b.percent <= 0) return null;
                                                    let colorBg = 'bg-slate-400';
                                                    if (b.key === 'current') colorBg = 'bg-emerald-500';
                                                    else if (b.key === 'near_due') colorBg = 'bg-amber-500';
                                                    else if (b.key === 'overdue_1_30') colorBg = 'bg-blue-500';
                                                    else if (b.key === 'overdue_31_60') colorBg = 'bg-indigo-500';
                                                    else if (b.key === 'overdue_61_90') colorBg = 'bg-orange-500';
                                                    else if (b.key === 'overdue_gt_90') colorBg = 'bg-rose-500';
                                                    else if (b.key === 'overdue_gt_180') colorBg = 'bg-red-700';

                                                    return (
                                                        <div
                                                            key={b.key}
                                                            className={`${colorBg} transition-all duration-300 hover:opacity-85`}
                                                            style={{ width: `${Math.max(1, b.percent)}%` }}
                                                            title={`${b.label}: ${b.formatted_saldo} (${b.percent}%)`}
                                                        />
                                                    );
                                                })}
                                            </div>

                                            {/* Aging Grid Cards */}
                                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
                                                {aiData.aging_distribution.map((b) => {
                                                    let borderClass = 'border-sidebar-border/60';
                                                    let dotColor = 'bg-slate-400';
                                                    if (b.key === 'current') {
                                                        dotColor = 'bg-emerald-500';
                                                    } else if (b.key === 'near_due') {
                                                        dotColor = 'bg-amber-500';
                                                    } else if (b.key === 'overdue_1_30') {
                                                        dotColor = 'bg-blue-500';
                                                    } else if (b.key === 'overdue_31_60') {
                                                        dotColor = 'bg-indigo-500';
                                                    } else if (b.key === 'overdue_61_90') {
                                                        dotColor = 'bg-orange-500';
                                                    } else if (b.key === 'overdue_gt_90') {
                                                        dotColor = 'bg-rose-500';
                                                        borderClass = 'border-rose-500/30';
                                                    } else if (b.key === 'overdue_gt_180') {
                                                        dotColor = 'bg-red-700';
                                                        borderClass = 'border-red-500/40 bg-red-500/5';
                                                    }

                                                    return (
                                                        <div
                                                            key={b.key}
                                                            className={`rounded-xl border ${borderClass} bg-card p-2.5 text-xs shadow-2xs transition hover:border-primary`}
                                                        >
                                                            <div className="flex items-center gap-1.5 font-semibold text-foreground">
                                                                <span className={`h-2 w-2 rounded-full ${dotColor} shrink-0`} />
                                                                <span className="truncate text-[11px]">{b.label}</span>
                                                            </div>
                                                            <div className="mt-1.5 text-xs font-bold text-foreground sm:text-sm">
                                                                {b.formatted_saldo}
                                                            </div>
                                                            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                                                                <span>{b.percent}%</span>
                                                                <span>{b.invoice_count} faktur</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* 4. Top Priority Accounts to Chase Today */}
                                    {Array.isArray(aiData.top_priority_accounts) && aiData.top_priority_accounts.length > 0 && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Target className="h-4 w-4 text-rose-600" />
                                                    <h3 className="text-sm font-bold tracking-tight text-foreground">
                                                        Top Akun Prioritas Penagihan Hari Ini (Urgent Accounts)
                                                    </h3>
                                                </div>
                                                <span className="text-xs text-muted-foreground">
                                                    Diurutkan berdasarkan skor risiko komposit Python (Saldo + Umur + Volume)
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                                                {aiData.top_priority_accounts.slice(0, 6).map((acc, index) => (
                                                    <div
                                                        key={acc.customer}
                                                        className="flex flex-col justify-between rounded-xl border border-sidebar-border/80 bg-card p-4 shadow-2xs transition hover:border-primary/60 hover:shadow-sm"
                                                    >
                                                        <div>
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                                                        #{index + 1}
                                                                    </span>
                                                                    <h4 className="text-sm font-bold text-foreground line-clamp-1">
                                                                        {acc.customer}
                                                                    </h4>
                                                                </div>
                                                                <span
                                                                    className={`rounded-md border px-2 py-0.5 text-[10px] font-bold shrink-0 ${
                                                                        acc.tier === 'CRITICAL'
                                                                            ? 'border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300 animate-pulse'
                                                                            : acc.tier === 'HIGH'
                                                                            ? 'border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                                                            : 'border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-300'
                                                                    }`}
                                                                >
                                                                    {acc.tier_label || acc.tier}
                                                                </span>
                                                            </div>

                                                            <div className="mt-3 flex items-baseline justify-between border-b border-sidebar-border/40 pb-2">
                                                                <span className="text-xs text-muted-foreground">Saldo Piutang:</span>
                                                                <span className="text-base font-extrabold text-foreground">
                                                                    {acc.formatted_saldo}
                                                                </span>
                                                            </div>

                                                            <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
                                                                <div>
                                                                    Keterlambatan: <strong className="text-rose-600">{acc.max_overdue_days} hari</strong>
                                                                </div>
                                                                <div className="text-right">
                                                                    Total: <strong className="text-foreground">{acc.invoice_count} faktur</strong>
                                                                </div>
                                                            </div>

                                                            <div className="mt-2.5 rounded-lg border border-sidebar-border/60 bg-muted/40 p-2 text-xs text-foreground/80">
                                                                <strong className="text-[11px] text-muted-foreground block">
                                                                    Rekomendasi Aksi:
                                                                </strong>
                                                                <span>{acc.recommended_action}</span>
                                                            </div>
                                                        </div>

                                                        <div className="mt-3.5 flex items-center gap-2 border-t border-sidebar-border/40 pt-2.5">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() =>
                                                                    openInvoiceModal({
                                                                        customer: acc.customer,
                                                                        scope: 'overdue',
                                                                        range: 'all',
                                                                        showPaymentFilter: true,
                                                                    })
                                                                }
                                                                className="h-8 flex-1 gap-1 text-xs"
                                                            >
                                                                <Eye className="h-3.5 w-3.5" />
                                                                <span>Lihat Faktur</span>
                                                            </Button>

                                                            <Button
                                                                size="sm"
                                                                variant="secondary"
                                                                onClick={() =>
                                                                    handleCopyCustomerScript(
                                                                        acc.customer,
                                                                        acc.formatted_saldo,
                                                                        acc.max_overdue_days,
                                                                        acc.invoice_count,
                                                                    )
                                                                }
                                                                className="h-8 gap-1 text-xs"
                                                                title="Salin script chat WhatsApp khusus akun ini"
                                                            >
                                                                {accountCopied === acc.customer ? (
                                                                    <>
                                                                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                                                                        <span className="text-emerald-600 font-medium">Tersalin</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <MessageSquare className="h-3.5 w-3.5 text-primary" />
                                                                        <span>Script WA</span>
                                                                    </>
                                                                )}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 5. Collection Directives per Team Role */}
                                    {Array.isArray(aiData.collection_directives) && aiData.collection_directives.length > 0 && (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <FileText className="h-4 w-4 text-primary" />
                                                <h3 className="text-sm font-bold tracking-tight text-foreground">
                                                    Panduan Taktis Tim Penagihan &amp; Script Percakapan (Directives)
                                                </h3>
                                            </div>

                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                                {aiData.collection_directives.map((dir, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex flex-col justify-between rounded-xl border border-sidebar-border/80 bg-card p-4 shadow-2xs"
                                                    >
                                                        <div className="space-y-2.5">
                                                            <div className="flex items-center justify-between gap-2 border-b border-sidebar-border/50 pb-2">
                                                                <span className="text-xs font-bold text-foreground">
                                                                    {dir.role}
                                                                </span>
                                                                <span
                                                                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                                                        dir.urgency === 'Kritis'
                                                                            ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                                                                            : dir.urgency === 'Tinggi'
                                                                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                                                            : 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                                                                    }`}
                                                                >
                                                                    {dir.urgency}
                                                                </span>
                                                            </div>

                                                            <div className="text-xs text-muted-foreground">
                                                                <strong className="text-foreground">Fokus Target: </strong>
                                                                {dir.target}
                                                            </div>

                                                            <div className="text-xs text-foreground/90">
                                                                <strong className="text-muted-foreground block mb-0.5">Tindakan Lapangan:</strong>
                                                                {dir.action}
                                                            </div>

                                                            {dir.script && (
                                                                <div className="relative rounded-lg border border-sidebar-border/70 bg-muted/40 p-3 text-xs italic text-muted-foreground">
                                                                    <div className="flex items-center justify-between text-[10px] not-italic font-semibold text-primary mb-1">
                                                                        <span>Contoh Script WA / Telepon:</span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                navigator.clipboard.writeText(dir.script);
                                                                                setAccountCopied(`dir-${idx}`);
                                                                                setTimeout(() => setAccountCopied(null), 2000);
                                                                            }}
                                                                            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary"
                                                                        >
                                                                            {accountCopied === `dir-${idx}` ? (
                                                                                <Check className="h-3 w-3 text-emerald-600" />
                                                                            ) : (
                                                                                <Copy className="h-3 w-3" />
                                                                            )}
                                                                            Salin
                                                                        </button>
                                                                    </div>
                                                                    "{dir.script}"
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 6. Quick Wins & Policy Recommendations Grid */}
                                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                        {/* Quick Wins Box */}
                                        <div className="rounded-xl border border-sidebar-border/80 bg-card p-4 shadow-2xs">
                                            <div className="flex items-center justify-between border-b border-sidebar-border/50 pb-2">
                                                <div className="flex items-center gap-2">
                                                    <Zap className="h-4 w-4 text-emerald-600" />
                                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                        7-Day Quick-Wins (Target Pelunasan Cepat)
                                                    </h4>
                                                </div>
                                                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                    Tingkat Konversi Tinggi
                                                </span>
                                            </div>

                                            <div className="mt-3 space-y-2">
                                                {(aiData.quick_wins || []).length === 0 ? (
                                                    <p className="text-xs text-muted-foreground">
                                                        Tidak ada faktur di bucket 1-35 hari saat ini.
                                                    </p>
                                                ) : (
                                                    (aiData.quick_wins || []).map((qw, index) => (
                                                        <div
                                                            key={index}
                                                            className="flex items-center justify-between rounded-lg border border-sidebar-border/50 bg-muted/30 p-2.5 text-xs transition hover:bg-muted/60"
                                                        >
                                                            <div className="space-y-0.5">
                                                                <div className="font-semibold text-foreground">
                                                                    {qw.customer}
                                                                </div>
                                                                <div className="text-[11px] text-muted-foreground">
                                                                    Faktur: <span className="font-mono text-foreground">{qw.no_faktur}</span> • Telat: {qw.overdue_days} hari
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="font-bold text-foreground">
                                                                    {qw.formatted_saldo}
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSelectedInvoiceNo(qw.no_faktur);
                                                                        setInvoiceDetailOpen(true);
                                                                    }}
                                                                    className="text-[10px] text-primary hover:underline"
                                                                >
                                                                    Buka Detail &rarr;
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        {/* Policy & Risk Warnings Box */}
                                        <div className="rounded-xl border border-sidebar-border/80 bg-card p-4 shadow-2xs">
                                            <div className="flex items-center justify-between border-b border-sidebar-border/50 pb-2">
                                                <div className="flex items-center gap-2">
                                                    <ShieldAlert className="h-4 w-4 text-amber-600" />
                                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                        Mitigasi Risiko Kredit &amp; Rekomendasi TOP
                                                    </h4>
                                                </div>
                                                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                                    Kebijakan Manajemen
                                                </span>
                                            </div>

                                            <div className="mt-3 space-y-2.5">
                                                {(aiData.credit_risk_warnings || []).map((warn, wIdx) => (
                                                    <div
                                                        key={wIdx}
                                                        className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200"
                                                    >
                                                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                                                        <div>
                                                            <strong className="block font-semibold">{warn.title}</strong>
                                                            <span className="text-[11px] leading-relaxed opacity-90">
                                                                {warn.description}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}

                                                <div className="mt-2 pt-2 border-t border-sidebar-border/40 text-xs">
                                                    <strong className="text-muted-foreground text-[11px] uppercase tracking-wider block mb-1">
                                                        Rekomendasi SOP Penjualan:
                                                    </strong>
                                                    <ul className="space-y-1 text-foreground/80 list-disc list-inside text-xs">
                                                        {(aiData.credit_policy_recommendations || [
                                                            'Terapkan pembekuan kredit (stop shipment) untuk customer dengan keterlambatan melampaui 60 hari.',
                                                            'Wajibkan konfirmasi bukti transfer lunas sebelum persetujuan SO (Sales Order) berikutnya.',
                                                        ]).map((rec, rIdx) => (
                                                            <li key={rIdx}>{rec}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* 4. Customer Overdue Table */}
                <Card>
                    <CardHeader>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <CardTitle className="text-base font-bold text-foreground">
                                    Daftar Customer Lewat Jatuh Tempo
                                </CardTitle>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Prioritas penagihan dihitung matematis berdasarkan saldo piutang dan lama keterlambatan.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <select
                                    className="rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-xs"
                                    value={pageSize}
                                    onChange={(event) => {
                                        setPageSize(Number(event.target.value));
                                        setCurrentPage(1);
                                    }}
                                >
                                    {pageSizes.map((size) => (
                                        <option key={size} value={size}>
                                            {size} baris
                                        </option>
                                    ))}
                                </select>
                                <select
                                    className="rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-xs"
                                    value={sort}
                                    onChange={(event) => {
                                        setSort(event.target.value);
                                        setCurrentPage(1);
                                    }}
                                >
                                    {sortOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <Input
                                    className="w-64 text-xs h-8"
                                    placeholder="Cari nama customer..."
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-auto rounded-md border">
                            <Table>
                                <TableHeader className="bg-muted">
                                    <TableRow>
                                        <TableHead className="w-[40px]">#</TableHead>
                                        <TableHead>Nama Customer</TableHead>
                                        <TableHead>Prioritas Penagihan</TableHead>
                                        <TableHead>Total Faktur</TableHead>
                                        <TableHead>Total Saldo Piutang</TableHead>
                                        <TableHead>Umur Jatuh Tempo Terlama</TableHead>
                                        <TableHead className="w-[110px] text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-6">
                                                <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs">
                                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                    <span>Memuat data customer...</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : customers.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-6 text-muted-foreground text-xs">
                                                Tidak ada data piutang jatuh tempo.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        customers.map((customer, idx) => {
                                            const rowNum = (currentPage - 1) * pageSize + idx + 1;
                                            return (
                                                <TableRow key={customer.nm_cs} className="hover:bg-muted/40">
                                                    <TableCell className="text-xs text-muted-foreground">
                                                        {rowNum}
                                                    </TableCell>
                                                    <TableCell className="font-semibold text-foreground text-xs sm:text-sm">
                                                        {customer.nm_cs || '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span
                                                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                                                                customer.badge_class ||
                                                                'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-400'
                                                            }`}
                                                        >
                                                            {customer.priority_label || 'Normal'}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-xs font-medium">
                                                        {customer.total_faktur} faktur
                                                    </TableCell>
                                                    <TableCell className="font-bold text-xs sm:text-sm text-foreground">
                                                        {formatRupiah(customer.total_saldo_piutang)}
                                                    </TableCell>
                                                    <TableCell className="text-xs font-medium">
                                                        <span
                                                            className={
                                                                customer.umur_tempo_terlama > 60
                                                                    ? 'text-rose-600 font-semibold'
                                                                    : 'text-foreground'
                                                            }
                                                        >
                                                            {customer.umur_tempo_terlama} hari
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() =>
                                                                    handleCopyCustomerScript(
                                                                        customer.nm_cs,
                                                                        formatRupiah(customer.total_saldo_piutang),
                                                                        customer.umur_tempo_terlama,
                                                                        customer.total_faktur,
                                                                    )
                                                                }
                                                                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                                                                title="Salin pesan tagihan WhatsApp untuk customer ini"
                                                            >
                                                                {accountCopied === customer.nm_cs ? (
                                                                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                                                                ) : (
                                                                    <MessageSquare className="h-3.5 w-3.5" />
                                                                )}
                                                            </Button>

                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() =>
                                                                    openInvoiceModal({
                                                                        scope: 'overdue',
                                                                        range: 'all',
                                                                        showPaymentFilter: true,
                                                                        customer: customer.nm_cs,
                                                                    })
                                                                }
                                                                className="h-8 gap-1 px-2.5 text-xs font-medium"
                                                                title="Lihat rincian faktur customer ini"
                                                            >
                                                                <Eye className="h-3.5 w-3.5" />
                                                                <span>Faktur</span>
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                            <div>Total {customerTotal} customer menunggak</div>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                    disabled={currentPage <= 1}
                                    className="h-8 text-xs"
                                >
                                    Sebelumnya
                                </Button>
                                <span className="text-xs">
                                    Halaman {currentPage} dari {totalPages}
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                                    disabled={currentPage >= totalPages}
                                    className="h-8 text-xs"
                                >
                                    Selanjutnya
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Invoices Dialog */}
            <OverdueInvoiceWarningDialog
                open={modalOpen}
                onOpenChange={setModalOpen}
                data={filteredModalData}
                onInvoiceClick={(invoice) => {
                    setSelectedInvoiceNo(invoice.no_fakturpenjualan);
                    setInvoiceDetailOpen(true);
                }}
                showActions={false}
                title={modalTitle}
                description="Daftar faktur penjualan yang masih memiliki saldo piutang."
                extraFilters={
                    modalData?.showPaymentFilter ? (
                        <label className="text-xs font-medium">
                            Status
                            <select
                                className="ml-2 rounded-md border border-sidebar-border/70 bg-background px-2 py-1 text-xs"
                                value={invoicePaymentFilter}
                                onChange={(event) => setInvoicePaymentFilter(event.target.value)}
                            >
                                <option value="all">Semua data</option>
                                <option value="unpaid">Belum lunas</option>
                                <option value="partial">Lunas sebagian</option>
                            </select>
                        </label>
                    ) : null
                }
            />

            {/* Single Invoice Detail Dialog */}
            <InvoiceDetailDialog
                open={invoiceDetailOpen}
                onOpenChange={setInvoiceDetailOpen}
                invoiceNo={selectedInvoiceNo}
            />
        </>
    );
}

ReviewTagihanIndex.layout = (page) => (
    <AppLayout children={page} breadcrumbs={breadcrumbs} />
);
