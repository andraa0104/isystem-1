import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { Head, Link } from '@inertiajs/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
    Activity,
    AlertCircle,
    AlertTriangle,
    ArrowDownRight,
    ArrowUpDown,
    ArrowUpRight,
    Award,
    Banknote,
    BarChart3,
    Bot,
    Building2,
    Calendar,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Clock,
    Copy,
    Cpu,
    Crown,
    Download,
    FileText,
    Filter,
    Layers,
    Minus,
    RefreshCw,
    RotateCcw,
    Search,
    ShieldAlert,
    ShieldCheck,
    Sparkles,
    Target,
    TrendingDown,
    TrendingUp,
    Users,
    X,
    Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ─── Formatters & Period Utilities ─── */

const formatRupiah = (value) =>
    `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(Number(value || 0)))}`;

const formatNumber = (value) =>
    new Intl.NumberFormat('id-ID').format(Math.round(Number(value || 0)));

const formatPercent = (value) => {
    const num = Number(value || 0);
    return `${num > 0 ? '+' : ''}${num.toFixed(2)}%`;
};

const formatCompactRupiah = (value) => {
    const num = Number(value || 0);
    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    if (abs >= 1_000_000_000) {
        const v = (abs / 1_000_000_000).toFixed(2);
        return `${sign}${v.replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1')} M`;
    }
    if (abs >= 1_000_000) {
        const v = (abs / 1_000_000).toFixed(2);
        return `${sign}${v.replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1')} jt`;
    }
    if (abs >= 1_000) {
        return `${sign}${Math.round(abs / 1_000)} rb`;
    }
    if (abs === 0) return 'Rp 0';
    return `${sign}Rp ${Math.round(abs)}`;
};

const formatBarLabel = (value) => {
    const num = Number(value || 0);
    if (num >= 1_000_000_000) {
        const v = (num / 1_000_000_000).toFixed(1);
        return `${v.replace(/\.0$/, '')}M`;
    }
    if (num >= 1_000_000) {
        const v = (num / 1_000_000).toFixed(1);
        return `${v.replace(/\.0$/, '')}jt`;
    }
    if (num >= 1_000) {
        return `${Math.round(num / 1_000)}rb`;
    }
    if (num <= 0) return '0';
    return String(Math.round(num));
};

const monthOptions = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Desember' },
];

const quarterOptions = [
    { value: 1, label: 'Triwulan 1 (Jan - Mar)' },
    { value: 2, label: 'Triwulan 2 (Apr - Jun)' },
    { value: 3, label: 'Triwulan 3 (Jul - Sep)' },
    { value: 4, label: 'Triwulan 4 (Okt - Des)' },
];

const semesterOptions = [
    { value: 1, label: 'Semester 1 (Jan - Jun)' },
    { value: 2, label: 'Semester 2 (Jul - Des)' },
];

const periodModeTabs = [
    { value: 'monthly', label: 'Bulanan' },
    { value: 'quarterly', label: 'Triwulan' },
    { value: 'semester', label: 'Semester' },
    { value: 'yearly', label: 'Tahunan' },
];

const statusFilterTabs = [
    { value: 'all', label: 'Semua' },
    { value: 'VIP', label: 'VIP' },
    { value: 'Akselerasi', label: 'Akselerasi' },
    { value: 'Stabil', label: 'Stabil' },
    { value: 'Potensial', label: 'Potensial' },
    { value: 'Menurun', label: 'Menurun / Kritis' },
    { value: 'Dormant', label: 'Dormant' },
    { value: 'Non-Aktif', label: 'Non-Aktif' },
];

const getLastClosedMonth = () => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - 1);
    const m = date.getMonth() + 1;
    return {
        year: date.getFullYear(),
        period_type: 'monthly',
        month: m,
        quarter: Math.ceil(m / 3),
        semester: m <= 6 ? 1 : 2,
        customer: 'all',
    };
};

const getCsrfToken = () => {
    if (typeof document === 'undefined') return '';
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta && meta.content) return meta.content;
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
};

const getXsrfCookieToken = () => {
    if (typeof document === 'undefined') return '';
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
};

/* ─── Unified Tone & Badge Mapping Helpers ─── */

const TONE_MAP = {
    emerald: {
        pill: 'border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
        dot: 'bg-emerald-500',
        bar: 'bg-emerald-500',
        ring: 'ring-emerald-500/30 border-emerald-500/50 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
    },
    cyan: {
        pill: 'border-cyan-500/35 bg-cyan-500/12 text-cyan-700 dark:text-cyan-300',
        dot: 'bg-cyan-500',
        bar: 'bg-cyan-500',
        ring: 'ring-cyan-500/30 border-cyan-500/50 bg-cyan-500/12 text-cyan-700 dark:text-cyan-300',
    },
    blue: {
        pill: 'border-sky-500/35 bg-sky-500/12 text-sky-700 dark:text-sky-300',
        dot: 'bg-sky-500',
        bar: 'bg-sky-500',
        ring: 'ring-sky-500/30 border-sky-500/50 bg-sky-500/12 text-sky-700 dark:text-sky-300',
    },
    indigo: {
        pill: 'border-indigo-500/35 bg-indigo-500/12 text-indigo-700 dark:text-indigo-300',
        dot: 'bg-indigo-500',
        bar: 'bg-indigo-500',
        ring: 'ring-indigo-500/30 border-indigo-500/50 bg-indigo-500/12 text-indigo-700 dark:text-indigo-300',
    },
    amber: {
        pill: 'border-amber-500/35 bg-amber-500/12 text-amber-700 dark:text-amber-300',
        dot: 'bg-amber-500',
        bar: 'bg-amber-500',
        ring: 'ring-amber-500/30 border-amber-500/50 bg-amber-500/12 text-amber-700 dark:text-amber-300',
    },
    orange: {
        pill: 'border-orange-500/35 bg-orange-500/12 text-orange-700 dark:text-orange-300',
        dot: 'bg-orange-500',
        bar: 'bg-orange-500',
        ring: 'ring-orange-500/30 border-orange-500/50 bg-orange-500/12 text-orange-700 dark:text-orange-300',
    },
    rose: {
        pill: 'border-rose-500/35 bg-rose-500/12 text-rose-700 dark:text-rose-300',
        dot: 'bg-rose-500',
        bar: 'bg-rose-500',
        ring: 'ring-rose-500/30 border-rose-500/50 bg-rose-500/12 text-rose-700 dark:text-rose-300',
    },
    slate: {
        pill: 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300',
        dot: 'bg-slate-400',
        bar: 'bg-slate-400',
        ring: 'ring-slate-500/30 border-slate-500/50 bg-slate-500/12 text-slate-700 dark:text-slate-300',
    },
};

const getToneStyle = (hint, label = '') => {
    const normalizedHint = String(hint || '').toLowerCase();
    if (normalizedHint === 'red') return TONE_MAP.rose;
    if (normalizedHint === 'gray') return TONE_MAP.slate;
    if (TONE_MAP[normalizedHint]) return TONE_MAP[normalizedHint];

    const lower = String(label || '').toLowerCase();
    if (lower.includes('vip growth') || lower.includes('champions') || lower.includes('akselerasi')) {
        return TONE_MAP.emerald;
    }
    if (lower.includes('vip at-risk') || lower.includes('kritis') || lower.includes('dormant') || lower.includes('anomali')) {
        return TONE_MAP.rose;
    }
    if (lower.includes('potensial') || lower.includes('potential') || lower.includes('baru')) {
        return TONE_MAP.cyan;
    }
    if (lower.includes('stabil') || lower.includes('loyal') || lower.includes('reguler')) {
        return TONE_MAP.blue;
    }
    if (lower.includes('signifikan')) {
        return TONE_MAP.orange;
    }
    if (lower.includes('menurun') || lower.includes('ringan') || lower.includes('at-risk')) {
        return TONE_MAP.amber;
    }
    return TONE_MAP.slate;
};

const matchesStatusFilter = (customer, filterKey) => {
    if (filterKey === 'all') return true;
    const raw = String(customer.ai_status || customer.status || '').toLowerCase();
    if (filterKey === 'VIP') return raw.includes('vip');
    if (filterKey === 'Akselerasi') return raw.includes('akselerasi');
    if (filterKey === 'Stabil') return raw.includes('stabil') || raw.includes('reguler');
    if (filterKey === 'Potensial') return raw.includes('potensial') || raw.includes('baru');
    if (filterKey === 'Menurun') {
        return (
            raw.includes('menurun') ||
            raw.includes('penurunan') ||
            raw.includes('kritis') ||
            raw.includes('drop') ||
            raw.includes('anomali')
        );
    }
    if (filterKey === 'Dormant') return raw.includes('dormant') || raw.includes('macet');
    if (filterKey === 'Non-Aktif') return raw.includes('non-aktif');
    return true;
};

const getHealthPalette = (score) => {
    const s = Number(score || 0);
    if (s >= 80) {
        return {
            stroke: '#10b981',
            badge: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300',
            text: 'text-emerald-400',
            glow: 'rgba(16, 185, 129, 0.3)',
        };
    }
    if (s >= 65) {
        return {
            stroke: '#06b6d4',
            badge: 'border-cyan-400/40 bg-cyan-500/15 text-cyan-300',
            text: 'text-cyan-400',
            glow: 'rgba(6, 182, 212, 0.3)',
        };
    }
    if (s >= 50) {
        return {
            stroke: '#f59e0b',
            badge: 'border-amber-400/40 bg-amber-500/15 text-amber-300',
            text: 'text-amber-400',
            glow: 'rgba(245, 158, 11, 0.3)',
        };
    }
    return {
        stroke: '#f43f5e',
        badge: 'border-rose-400/40 bg-rose-500/15 text-rose-300',
        text: 'text-rose-400',
        glow: 'rgba(244, 63, 94, 0.3)',
    };
};

const breadcrumbs = [
    { title: 'Marketing', href: '/marketing/performance' },
    { title: 'Performa Sales & Customer', href: '/marketing/performance' },
];

/* ─── Login-Inspired Visual Subcomponents ─── */

/**
 * Ambient cosmic ornaments inspired by the login cosmos hero banner.
 * Uses pure GPU transform animations (opacity/x/y/rotate) for smooth rendering
 * across Windows 7, 8, 10, and 11 browsers.
 */
function CosmosHeroOrnaments() {
    const prefersReduced = useReducedMotion();

    return (
        <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
        >
            {/* Subtle dot-matrix + cyber hairline grid (matching login.css fs-cyber-grid) */}
            <div
                className="absolute inset-0 opacity-60"
                style={{
                    backgroundImage:
                        'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)',
                    backgroundSize: '32px 32px, 64px 64px, 64px 64px',
                }}
            />

            {/* Connecting SVG Energy Flow Lines (matching login.jsx fs-energy-lines) */}
            <motion.svg
                className="hidden lg:block absolute inset-0 h-full w-full opacity-35"
                viewBox="0 0 1200 320"
                fill="none"
                preserveAspectRatio="none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.35 }}
                transition={{ duration: 0.9, delay: 0.25 }}
            >
                <motion.path
                    d="M920 40 L1060 115 L1180 65"
                    stroke="#10b981"
                    strokeWidth="1.25"
                    strokeDasharray="4 4"
                    initial={prefersReduced ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.1, delay: 0.35, ease: 'easeOut' }}
                />
                <motion.path
                    d="M840 190 L1020 140 L1160 220"
                    stroke="#06b6d4"
                    strokeWidth="1.25"
                    strokeDasharray="4 4"
                    initial={prefersReduced ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.2, delay: 0.5, ease: 'easeOut' }}
                />
            </motion.svg>

            {/* Floating Nebula Orbs */}
            <motion.div
                className="absolute -top-24 -left-20 h-72 w-72 rounded-full"
                style={{
                    background: 'radial-gradient(circle, rgba(16, 185, 129, 0.24) 0%, transparent 70%)',
                }}
                animate={
                    prefersReduced
                        ? undefined
                        : { x: [0, 30, -10, 0], y: [0, 20, -10, 0], scale: [1, 1.08, 0.95, 1] }
                }
                transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
                className="absolute -right-24 -bottom-28 h-80 w-80 rounded-full"
                style={{
                    background: 'radial-gradient(circle, rgba(6, 182, 212, 0.22) 0%, transparent 70%)',
                }}
                animate={
                    prefersReduced
                        ? undefined
                        : { x: [0, -28, 15, 0], y: [0, -20, 12, 0], scale: [1, 0.94, 1.07, 1] }
                }
                transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
            />
            <motion.div
                className="hidden md:block absolute top-1/3 left-1/2 h-56 w-56 rounded-full"
                style={{
                    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.16) 0%, transparent 70%)',
                }}
                animate={prefersReduced ? undefined : { x: [-20, 25, -20], y: [10, -20, 10] }}
                transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Floating 4-Point Sparkling Star (inspired by login.jsx fs-ornament-sparkle) */}
            <motion.div
                className="hidden sm:block absolute top-6 left-[34%] opacity-75"
                animate={
                    prefersReduced
                        ? undefined
                        : {
                              x: [0, 24, -14, 16, 0],
                              y: [0, 16, -12, 8, 0],
                              rotate: [0, 180, 360],
                              scale: [0.85, 1.2, 0.8, 1.1, 0.85],
                          }
                }
                transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
            >
                <svg width="26" height="26" viewBox="0 0 34 34" fill="none">
                    <path
                        d="M17 2 L20 13 L31 17 L20 21 L17 32 L14 21 L3 17 L14 13 Z"
                        fill="#34d399"
                        opacity="0.7"
                    />
                </svg>
            </motion.div>

            {/* Floating Tech Crosshair / Plus (inspired by login.jsx fs-ornament-plus) */}
            <motion.div
                className="hidden md:block absolute top-14 right-[30%] opacity-65"
                animate={
                    prefersReduced
                        ? undefined
                        : {
                              x: [0, -22, 18, -12, 0],
                              y: [0, 14, -18, 10, 0],
                              rotate: [0, 90, 180],
                              scale: [0.9, 1.12, 0.9, 1.08, 0.9],
                          }
                }
                transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
            >
                <svg width="26" height="26" viewBox="0 0 30 30" fill="none">
                    <line x1="15" y1="4" x2="15" y2="26" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" opacity="0.65" />
                    <line x1="4" y1="15" x2="26" y2="15" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" opacity="0.65" />
                    <circle cx="15" cy="15" r="7" stroke="#06b6d4" strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
                </svg>
            </motion.div>

            {/* Floating Rhombus / Diamond Cube (Indigo) */}
            <motion.div
                className="hidden lg:block absolute top-28 right-[19%] opacity-65"
                animate={
                    prefersReduced
                        ? undefined
                        : {
                              x: [0, -18, 20, -10, 0],
                              y: [0, -14, 16, -8, 0],
                              rotate: [0, -90, -180, -270, -360],
                              scale: [0.92, 1.1, 0.95, 1.08, 0.92],
                          }
                }
                transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
            >
                <svg width="30" height="30" viewBox="0 0 38 38" fill="none">
                    <rect
                        x="7"
                        y="7"
                        width="24"
                        height="24"
                        rx="5"
                        transform="rotate(45 19 19)"
                        stroke="#818cf8"
                        strokeWidth="1.5"
                        opacity="0.65"
                    />
                    <circle cx="19" cy="19" r="3.5" fill="#818cf8" opacity="0.55" />
                </svg>
            </motion.div>

            {/* Floating Live HUD Telemetry Pill (inspired by login.jsx fs-ornament-badge) */}
            <motion.div
                className="hidden xl:inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-slate-900/75 px-2.5 py-1 text-[10px] font-bold tracking-widest text-emerald-300/80 shadow-sm absolute top-5 right-[42%]"
                animate={
                    prefersReduced
                        ? undefined
                        : {
                              x: [0, -18, 12, -16, 0],
                              y: [0, 10, -8, 6, 0],
                              rotate: [-2, 2, -2],
                          }
                }
                transition={{ duration: 21, repeat: Infinity, ease: 'easeInOut' }}
            >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>KPI::LIVE</span>
            </motion.div>

            {/* Concentric Orbital Telemetry Rings on Desktop Right */}
            <motion.div
                className="hidden lg:block absolute -top-12 right-16 h-60 w-60 rounded-full border border-dashed border-emerald-400/20"
                initial={{ scale: 0.75, opacity: 0 }}
                animate={
                    prefersReduced
                        ? { scale: 1, opacity: 1 }
                        : { scale: 1, opacity: 1, rotate: 360 }
                }
                transition={{
                    scale: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
                    opacity: { duration: 0.7 },
                    rotate: { duration: 48, repeat: Infinity, ease: 'linear' },
                }}
            />
            <motion.div
                className="hidden lg:block absolute -top-2 right-26 h-40 w-40 rounded-full border border-dashed border-cyan-400/20"
                initial={{ scale: 0.65, opacity: 0 }}
                animate={
                    prefersReduced
                        ? { scale: 1, opacity: 1 }
                        : { scale: 1, opacity: 1, rotate: -360 }
                }
                transition={{
                    scale: { duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] },
                    opacity: { duration: 0.6, delay: 0.1 },
                    rotate: { duration: 32, repeat: Infinity, ease: 'linear' },
                }}
            />
        </div>
    );
}

/**
 * Top-right Tailwind + Motion notification toast (replaces SweetAlert).
 */
function TopRightToast({ toast, onClose }) {
    return (
        <AnimatePresence>
            {toast && (
                <motion.div
                    key={toast.id}
                    role="status"
                    aria-live="polite"
                    initial={{ opacity: 0, x: 40, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 40, scale: 0.95 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="fixed top-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl"
                >
                    <div className="flex items-start gap-3 p-4">
                        <div
                            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                                toast.type === 'error'
                                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            }`}
                        >
                            {toast.type === 'error' ? (
                                <AlertCircle className="h-4 w-4" />
                            ) : (
                                <CheckCircle2 className="h-4 w-4" />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {toast.title}
                            </p>
                            {toast.message && (
                                <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                                    {toast.message}
                                </p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Tutup notifikasi"
                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <motion.div
                        initial={{ scaleX: 1 }}
                        animate={{ scaleX: 0 }}
                        transition={{ duration: 4.5, ease: 'linear' }}
                        style={{ transformOrigin: 'left center' }}
                        className={`h-1 w-full ${
                            toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'
                        }`}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/**
 * Animated radial SVG gauge for AI Health Score (0-100).
 */
function HealthScoreGauge({ score = 0, statusLabel = '-' }) {
    const safeScore = Math.max(0, Math.min(100, Number(score || 0)));
    const palette = getHealthPalette(safeScore);
    const radius = 38;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference - (safeScore / 100) * circumference;

    return (
        <div className="flex items-center gap-4">
            <motion.div
                initial={{ scale: 0.88, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="relative flex h-24 w-24 shrink-0 items-center justify-center"
            >
                <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96">
                    <circle
                        cx="48"
                        cy="48"
                        r={radius}
                        stroke="rgba(148, 163, 184, 0.22)"
                        strokeWidth="8"
                        fill="none"
                    />
                    <motion.circle
                        cx="48"
                        cy="48"
                        r={radius}
                        stroke={palette.stroke}
                        strokeWidth="8"
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray={circumference}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset: dashOffset }}
                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <AnimatePresence mode="wait">
                        <motion.span
                            key={safeScore}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.2 }}
                            className={`text-2xl font-extrabold tabular-nums ${palette.text}`}
                        >
                            {safeScore}
                        </motion.span>
                    </AnimatePresence>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        / 100
                    </span>
                </div>
            </motion.div>
            <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Health Score
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                    <motion.span
                        key={statusLabel}
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.25 }}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${palette.badge}`}
                    >
                        <Activity className="h-3 w-3" />
                        {statusLabel || 'Terukur'}
                    </motion.span>
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
                    Skor komposit dari pertumbuhan, retensi, HHI, dan frekuensi faktur.
                </p>
            </div>
        </div>
    );
}

/**
 * Gemini + Core Orb Indicator (echoing the login page Gemini orb effect).
 */
function AiEngineCoreBadge({ loading }) {
    return (
        <motion.div
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/35 bg-slate-900 shadow-inner"
            animate={{
                boxShadow: loading
                    ? [
                          '0 0 12px rgba(16, 185, 129, 0.25)',
                          '0 0 28px rgba(6, 182, 212, 0.5)',
                          '0 0 12px rgba(16, 185, 129, 0.25)',
                      ]
                    : [
                          '0 0 10px rgba(16, 185, 129, 0.18)',
                          '0 0 20px rgba(16, 185, 129, 0.35)',
                          '0 0 10px rgba(16, 185, 129, 0.18)',
                      ],
            }}
            transition={{
                duration: loading ? 1.8 : 3.6,
                repeat: Infinity,
                ease: 'easeInOut',
            }}
        >
            <motion.div
                className="absolute -inset-1 rounded-2xl border border-dashed border-cyan-400/40"
                animate={{ rotate: 360 }}
                transition={{
                    duration: loading ? 3.5 : 16,
                    repeat: Infinity,
                    ease: 'linear',
                }}
            />
            {loading ? (
                <motion.div
                    animate={{ rotate: [0, 180, 360], scale: [0.95, 1.15, 0.95] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                    <Sparkles className="h-5 w-5 text-emerald-400" />
                </motion.div>
            ) : (
                <Bot className="h-5 w-5 text-emerald-400" />
            )}
        </motion.div>
    );
}

/**
 * Bento KPI Stat Card with subtle gradient top hairline and micro-motion hover.
 */
function KpiBentoCard({
    index = 0,
    title,
    value,
    subtitle,
    accentClass,
    icon: Icon,
    iconBgClass,
    badge,
    footer,
    loading,
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
                duration: 0.45,
                delay: 0.06 * index,
                ease: [0.16, 1, 0.3, 1],
            }}
            whileHover={{ y: -4, transition: { duration: 0.2, ease: 'easeOut' } }}
            whileTap={{ scale: 0.99 }}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-sidebar-border/80 bg-card p-4 shadow-xs transition-shadow hover:shadow-md sm:p-5"
        >
            {/* Top Glowing Accent Bar */}
            <div className={`absolute top-0 right-0 left-0 h-1 ${accentClass}`} />

            {/* Subtle Sheen Overlay on Hover */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-all duration-700 group-hover:translate-x-full group-hover:opacity-100"
            />

            <div className="relative z-10 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        {title}
                    </span>
                    {loading ? (
                        <div className="mt-2.5 h-7 w-32 animate-pulse rounded-lg bg-muted" />
                    ) : (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={String(value)}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                                className="mt-1.5 truncate text-lg font-extrabold tracking-tight text-foreground tabular-nums sm:text-xl"
                                title={typeof value === 'string' ? value : undefined}
                            >
                                {value}
                            </motion.div>
                        </AnimatePresence>
                    )}
                </div>
                <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 ${iconBgClass}`}
                >
                    <Icon className="h-5 w-5" />
                </div>
            </div>

            {badge && <div className="relative z-10 mt-2.5">{badge}</div>}

            {(subtitle || footer) && (
                <div className="relative z-10 mt-3 border-t border-sidebar-border/60 pt-2.5 text-[11px] leading-snug text-muted-foreground">
                    {subtitle}
                    {footer}
                </div>
            )}
        </motion.div>
    );
}

/**
 * Interactive Responsive SVG Column Chart with fixed telemetry header bar
 * (ensures zero tooltip clipping on mobile and 1280x720 / 1366x768 Windows 7-11 displays).
 */
function SalesChartPanel({
    chartData,
    loading,
    periodType,
    hoveredChartItem,
    setHoveredChartItem,
    onBarClick,
}) {
    const items = chartData?.items || [];
    const totalChartSales = useMemo(
        () => items.reduce((acc, it) => acc + Number(it.sales || 0), 0),
        [items],
    );
    const avgChartSales = items.length > 0 ? totalChartSales / items.length : 0;

    const maxSales = useMemo(() => {
        if (!items.length) return 1000000;
        const m = Math.max(...items.map((i) => Number(i.sales || 0)));
        return m > 0 ? m * 1.18 : 1000000;
    }, [items]);

    const yTicks = useMemo(
        () => [0, 0.25, 0.5, 0.75, 1].map((r) => maxSales * r),
        [maxSales],
    );

    const activeItem = useMemo(
        () => hoveredChartItem || items.find((it) => it.is_active) || null,
        [hoveredChartItem, items],
    );

    const svgWidth = 860;
    const svgHeight = 300;
    const padLeft = 64;
    const padRight = 20;
    const padTop = 32;
    const padBottom = 46;
    const plotWidth = svgWidth - padLeft - padRight;
    const plotHeight = svgHeight - padTop - padBottom;

    return (
        <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden rounded-3xl border border-sidebar-border/80 bg-card shadow-xs"
        >
            {/* Header + Live Inspection Readout */}
            <div className="flex flex-col gap-3 border-b border-sidebar-border/70 bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/12 text-cyan-600 dark:text-cyan-400">
                        <BarChart3 className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                            {chartData?.title || 'Grafik Perkembangan Penjualan'}
                        </h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            Arahkan kursor pada batang untuk detail nominal &bull; Klik batang untuk berpindah ke periode tersebut
                        </p>
                    </div>
                </div>

                {/* Live Telemetry Pill */}
                <div className="flex flex-wrap items-center gap-2">
                    <AnimatePresence mode="wait">
                        {activeItem ? (
                            <motion.div
                                key={`chart-pill-${activeItem.key}-${activeItem.sales}`}
                                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                                className="flex flex-wrap items-center gap-2.5 rounded-xl border border-emerald-500/35 bg-emerald-500/12 px-3 py-2 text-xs shadow-xs"
                            >
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="font-bold text-foreground">
                                    {activeItem.full_label}
                                </span>
                                <span className="font-extrabold text-emerald-600 tabular-nums dark:text-emerald-400">
                                    {formatRupiah(activeItem.sales)}
                                </span>
                                <span className="rounded-md bg-background/85 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
                                    {formatNumber(activeItem.invoices)} faktur
                                </span>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="chart-pill-avg"
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.18 }}
                                className="rounded-xl border border-sidebar-border bg-background/70 px-3 py-1.5 text-xs text-muted-foreground"
                            >
                                Rata-rata seri:{' '}
                                <strong className="text-foreground tabular-nums">
                                    {formatCompactRupiah(avgChartSales)}
                                </strong>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Chart Body */}
            <div className="p-4 sm:p-6">
                {loading && items.length === 0 ? (
                    <div className="flex h-64 items-center justify-center">
                        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                            <RefreshCw className="h-4 w-4 animate-spin text-emerald-500" />
                            <span>Memuat grafik tren penjualan...</span>
                        </div>
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex h-60 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                        <BarChart3 className="h-9 w-9 opacity-30" />
                        <p className="text-sm font-medium">
                            Tidak ada data penjualan untuk periode grafik ini.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Scrollable on very narrow screens if many bars (e.g. 12 months on 320px mobile) */}
                        <div className="overflow-x-auto pb-2">
                            <div className={items.length > 6 ? 'min-w-[600px]' : 'w-full'}>
                                <svg
                                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                                    className="h-auto w-full select-none"
                                    role="img"
                                    aria-label={chartData?.title || 'Grafik Penjualan'}
                                >
                                    <defs>
                                        <linearGradient id="perfBarActive" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#10b981" />
                                            <stop offset="100%" stopColor="#059669" stopOpacity="0.88" />
                                        </linearGradient>
                                        <linearGradient id="perfBarRegular" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.88" />
                                            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.72" />
                                        </linearGradient>
                                        <linearGradient id="perfBarHover" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#22d3ee" />
                                            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.92" />
                                        </linearGradient>
                                    </defs>

                                    {/* Y-Axis Gridlines & Labels */}
                                    {yTicks.map((tick, idx) => {
                                        const y =
                                            padTop +
                                            plotHeight -
                                            (tick / maxSales) * plotHeight;
                                        return (
                                            <g key={`ytick-${idx}`}>
                                                <line
                                                    x1={padLeft}
                                                    y1={y}
                                                    x2={svgWidth - padRight}
                                                    y2={y}
                                                    stroke="currentColor"
                                                    strokeOpacity={idx === 0 ? 0.18 : 0.08}
                                                    strokeDasharray={idx === 0 ? undefined : '4 4'}
                                                    className="text-foreground"
                                                />
                                                <text
                                                    x={padLeft - 10}
                                                    y={y + 4}
                                                    textAnchor="end"
                                                    className="fill-muted-foreground text-[11px] font-medium tabular-nums"
                                                >
                                                    {formatCompactRupiah(tick)}
                                                </text>
                                            </g>
                                        );
                                    })}

                                    {/* Bars */}
                                    {items.map((item, idx) => {
                                        const slotWidth = plotWidth / items.length;
                                        const maxBarW =
                                            periodType === 'monthly'
                                                ? 44
                                                : items.length <= 4
                                                  ? 88
                                                  : 68;
                                        const barW = Math.max(
                                            16,
                                            Math.min(maxBarW, slotWidth * 0.56),
                                        );
                                        const x =
                                            padLeft +
                                            idx * slotWidth +
                                            (slotWidth - barW) / 2;
                                        const val = Math.max(0, Number(item.sales || 0));
                                        const barH =
                                            val > 0
                                                ? Math.max(4, (val / maxSales) * plotHeight)
                                                : 2;
                                        const y = padTop + plotHeight - barH;
                                        const isHovered = hoveredChartItem?.key === item.key;
                                        const isActive = Boolean(item.is_active);
                                        const fillId = isActive
                                            ? 'url(#perfBarActive)'
                                            : isHovered
                                              ? 'url(#perfBarHover)'
                                              : 'url(#perfBarRegular)';

                                        return (
                                            <g
                                                key={`bar-${item.key}`}
                                                onMouseEnter={() => setHoveredChartItem(item)}
                                                onMouseLeave={() => setHoveredChartItem(null)}
                                                onClick={() => onBarClick(item)}
                                                className="cursor-pointer"
                                            >
                                                {/* Full-height invisible hit target for easy hover/tap */}
                                                <rect
                                                    x={padLeft + idx * slotWidth}
                                                    y={padTop}
                                                    width={slotWidth}
                                                    height={plotHeight + 24}
                                                    fill="transparent"
                                                />

                                                {/* Subtle active column highlight */}
                                                {(isActive || isHovered) && (
                                                    <rect
                                                        x={x - 5}
                                                        y={padTop}
                                                        width={barW + 10}
                                                        height={plotHeight}
                                                        rx="8"
                                                        fill={
                                                            isActive
                                                                ? 'rgba(16, 185, 129, 0.08)'
                                                                : 'rgba(14, 165, 233, 0.08)'
                                                        }
                                                    />
                                                )}

                                                {/* Bar shape (Animated baseline upward growth) */}
                                                <motion.rect
                                                    x={x}
                                                    width={barW}
                                                    rx="6"
                                                    fill={val > 0 ? fillId : 'rgba(148, 163, 184, 0.25)'}
                                                    stroke={
                                                        isActive
                                                            ? '#10b981'
                                                            : isHovered
                                                              ? '#06b6d4'
                                                              : 'none'
                                                    }
                                                    strokeWidth={isActive || isHovered ? 1.5 : 0}
                                                    initial={{ y: padTop + plotHeight, height: 0 }}
                                                    animate={{ y, height: barH }}
                                                    transition={{
                                                        duration: 0.52,
                                                        delay: Math.min(idx * 0.032, 0.36),
                                                        ease: [0.16, 1, 0.3, 1],
                                                    }}
                                                />

                                                {/* Top compact amount label */}
                                                {val > 0 && (
                                                    <motion.text
                                                        x={x + barW / 2}
                                                        y={Math.max(14, y - 8)}
                                                        textAnchor="middle"
                                                        initial={{ opacity: 0, y: 4 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{
                                                            duration: 0.3,
                                                            delay: Math.min(idx * 0.032 + 0.2, 0.55),
                                                        }}
                                                        className={`text-[10.5px] font-bold tabular-nums ${
                                                            isActive
                                                                ? 'fill-emerald-600 dark:fill-emerald-400'
                                                                : isHovered
                                                                  ? 'fill-cyan-600 dark:fill-cyan-400'
                                                                  : 'fill-muted-foreground'
                                                        }`}
                                                    >
                                                        {formatBarLabel(val)}
                                                    </motion.text>
                                                )}

                                                {/* X-axis label */}
                                                <text
                                                    x={x + barW / 2}
                                                    y={padTop + plotHeight + 20}
                                                    textAnchor="middle"
                                                    className={`text-[11.5px] ${
                                                        isActive
                                                            ? 'fill-emerald-600 font-extrabold dark:fill-emerald-400'
                                                            : isHovered
                                                              ? 'fill-foreground font-bold'
                                                              : 'fill-muted-foreground font-medium'
                                                    }`}
                                                >
                                                    {item.label}
                                                </text>

                                                {/* Active pulsing dot marker under X label */}
                                                {isActive && (
                                                    <motion.circle
                                                        cx={x + barW / 2}
                                                        cy={padTop + plotHeight + 31}
                                                        r="3.2"
                                                        fill="#10b981"
                                                        animate={{
                                                            scale: [1, 1.35, 1],
                                                            opacity: [0.95, 0.5, 0.95],
                                                        }}
                                                        transition={{
                                                            duration: 2,
                                                            repeat: Infinity,
                                                            ease: 'easeInOut',
                                                        }}
                                                    />
                                                )}
                                            </g>
                                        );
                                    })}
                                </svg>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-sidebar-border/60 pt-3 text-xs text-muted-foreground">
                            <div className="flex flex-wrap items-center gap-4">
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                                    Periode Aktif Dipilih
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="h-2.5 w-2.5 rounded-sm bg-sky-500" />
                                    Periode Pembanding / Lainnya (Klik untuk Switch)
                                </span>
                            </div>
                            <span className="tabular-nums">
                                Total Seri Grafik:{' '}
                                <strong className="text-foreground">
                                    {formatRupiah(totalChartSales)}
                                </strong>
                            </span>
                        </div>
                    </>
                )}
            </div>
        </motion.section>
    );
}

/**
 * Reusable Top-5 Customer Leaderboard Bento Card (used cleanly for both Top 5 Highest and Top 5 Lowest/Declining).
 */
function LeaderboardBentoCard({
    variant = 'highest',
    title,
    subtitle,
    rows = [],
    loading,
    periodInfo,
    lowestMode,
    setLowestMode,
    getCustomerDetailUrl,
}) {
    const isHighest = variant === 'highest';

    const getRankStyle = (rankNum) => {
        if (isHighest) {
            if (rankNum === 1) return 'bg-amber-500 text-slate-950 shadow-xs';
            if (rankNum === 2) return 'bg-slate-300 text-slate-900 dark:bg-slate-400';
            if (rankNum === 3) return 'bg-orange-400 text-slate-950';
            return 'bg-muted text-muted-foreground';
        }
        return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25';
    };

    return (
        <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: isHighest ? 0.2 : 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col overflow-hidden rounded-3xl border border-sidebar-border/80 bg-card shadow-xs"
        >
            {/* Card Header */}
            <div className="flex flex-col gap-3 border-b border-sidebar-border/70 bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
                <div className="flex items-start gap-3">
                    <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                            isHighest
                                ? 'border-emerald-500/30 bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                                : 'border-rose-500/30 bg-rose-500/12 text-rose-600 dark:text-rose-400'
                        }`}
                    >
                        {isHighest ? (
                            <Award className="h-5 w-5" />
                        ) : (
                            <AlertTriangle className="h-5 w-5" />
                        )}
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm font-bold tracking-tight text-foreground sm:text-base">
                            {title}
                        </h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {subtitle}
                        </p>
                    </div>
                </div>

                {/* Mode Switcher on Watchlist Card */}
                {!isHighest && (
                    <div className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-sidebar-border bg-background/80 p-1">
                        {[
                            { id: 'nominal', label: 'Nominal Terkecil' },
                            { id: 'drop', label: 'Penurunan Terbesar' },
                        ].map((tab) => {
                            const active = lowestMode === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setLowestMode(tab.id)}
                                    className={`relative rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                                        active
                                            ? 'text-white'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {active && (
                                        <motion.span
                                            layoutId="lowestModeSwitch"
                                            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                                            className="absolute inset-0 rounded-lg bg-rose-600 shadow-xs"
                                        />
                                    )}
                                    <span className="relative z-10">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="flex-1 divide-y divide-sidebar-border/50">
                {loading && rows.length === 0 ? (
                    <div className="space-y-3 p-5">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/60" />
                        ))}
                    </div>
                ) : rows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center text-muted-foreground">
                        {isHighest ? (
                            <Award className="h-8 w-8 opacity-30" />
                        ) : (
                            <ShieldCheck className="h-8 w-8 text-emerald-500/60" />
                        )}
                        <p className="text-xs font-medium">
                            {isHighest
                                ? `Belum ada transaksi customer tertinggi pada ${periodInfo?.currentLabel || 'periode ini'}.`
                                : lowestMode === 'drop'
                                  ? 'Tidak ada customer dengan penurunan omset pada periode ini.'
                                  : 'Belum ada transaksi customer terendah pada periode ini.'}
                        </p>
                    </div>
                ) : (
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={`${variant}-${isHighest ? 'top' : lowestMode}-${rows.map((r) => r.kd_cs).join(',')}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="divide-y divide-sidebar-border/50"
                        >
                            {rows.map((c, idx) => {
                                const rankNum = c.rank ?? idx + 1;
                                const growthVal = Number(c.growth || 0);
                                const actionText =
                                    c.ai_team_action || c.marketing_action || c.ai_action || '-';
                                return (
                                    <motion.div
                                        key={`${c.kd_cs}-${idx}`}
                                        initial={{ opacity: 0, x: -12 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{
                                            duration: 0.3,
                                            delay: idx * 0.045,
                                            ease: [0.16, 1, 0.3, 1],
                                        }}
                                        whileHover={{ x: 3 }}
                                        className="flex flex-col gap-2.5 p-4 transition-colors hover:bg-muted/25 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div className="flex min-w-0 items-start gap-3">
                                            <span
                                                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold tabular-nums ${getRankStyle(rankNum)}`}
                                            >
                                                {rankNum}
                                            </span>
                                            <div className="min-w-0">
                                                <Link
                                                    href={getCustomerDetailUrl(c.kd_cs)}
                                                    className="line-clamp-1 text-sm font-bold text-foreground transition-colors hover:text-emerald-600 dark:hover:text-emerald-400"
                                                    title={`Lihat rincian ${c.nm_cs}`}
                                                >
                                                    {c.nm_cs}
                                                </Link>
                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                                    <span className="font-mono">{c.kd_cs}</span>
                                                    <span>&bull;</span>
                                                    <span className="tabular-nums">
                                                        {formatNumber(c.curr_invoices)} faktur
                                                    </span>
                                                    {isHighest && Number(c.contribution || 0) > 0 && (
                                                        <>
                                                            <span>&bull;</span>
                                                            <span className="font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
                                                                {Number(c.contribution).toFixed(1)}% pangsa
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                                {actionText !== '-' && (
                                                    <div className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-lg border border-sidebar-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground/85">
                                                        <span className="truncate">{actionText}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex shrink-0 items-center justify-between gap-3 pl-10 sm:flex-col sm:items-end sm:justify-center sm:pl-0">
                                            <div className="text-right">
                                                <div className="text-sm font-extrabold text-foreground tabular-nums">
                                                    {lowestMode === 'drop' && !isHighest
                                                        ? formatRupiah(c.diff_sales)
                                                        : formatRupiah(c.curr_sales)}
                                                </div>
                                                {lowestMode === 'drop' && !isHighest && (
                                                    <div className="text-[10.5px] text-muted-foreground tabular-nums">
                                                        Kini: {formatCompactRupiah(c.curr_sales)}
                                                    </div>
                                                )}
                                            </div>
                                            <span
                                                className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                                                    growthVal > 0
                                                        ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                                                        : growthVal < 0
                                                          ? 'bg-rose-500/12 text-rose-600 dark:text-rose-400'
                                                          : 'bg-muted text-muted-foreground'
                                                }`}
                                            >
                                                {growthVal > 0 ? (
                                                    <ArrowUpRight className="h-3 w-3" />
                                                ) : growthVal < 0 ? (
                                                    <ArrowDownRight className="h-3 w-3" />
                                                ) : (
                                                    <Minus className="h-3 w-3" />
                                                )}
                                                {formatPercent(growthVal)}
                                            </span>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </motion.div>
                    </AnimatePresence>
                )}
            </div>
        </motion.section>
    );
}

/* ─── Main Page Component ─── */

export default function PerformanceIndex({
    initialFilters = {},
    defaultFilters = {},
    availableYears = [],
    customersList = [],
}) {
    const closedPeriodDefaults = useMemo(
        () => ({
            ...getLastClosedMonth(),
            ...defaultFilters,
        }),
        [defaultFilters],
    );

    // Filter state (identical semantics to backend extractFilters)
    const [year, setYear] = useState(
        Number(initialFilters.year ?? closedPeriodDefaults.year),
    );
    const [periodType, setPeriodType] = useState(
        initialFilters.period_type ?? closedPeriodDefaults.period_type,
    );
    const [month, setMonth] = useState(
        Number(initialFilters.month ?? closedPeriodDefaults.month),
    );
    const [quarter, setQuarter] = useState(
        Number(initialFilters.quarter ?? closedPeriodDefaults.quarter),
    );
    const [semester, setSemester] = useState(
        Number(initialFilters.semester ?? closedPeriodDefaults.semester),
    );
    const [customer, setCustomer] = useState(
        initialFilters.customer ?? 'all',
    );

    // Performance data & table UI state
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [searchCustomer, setSearchCustomer] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [clusterFilter, setClusterFilter] = useState('all');
    const [sortField, setSortField] = useState('rank');
    const [sortDirection, setSortDirection] = useState('asc');
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(5);
    const [hoveredChartItem, setHoveredChartItem] = useState(null);
    const [lowestMode, setLowestMode] = useState('nominal');

    // AI & Machine Learning states
    const [aiLoading, setAiLoading] = useState(false);
    const [aiData, setAiData] = useState(null);
    const [aiEngine, setAiEngine] = useState('Qwen 2.5 7B Analytics Engine');
    const [aiIsFallback, setAiIsFallback] = useState(false);
    const [aiNotice, setAiNotice] = useState(null);
    const [aiError, setAiError] = useState(null);
    const [aiCopied, setAiCopied] = useState(false);
    const [aiCollapsed, setAiCollapsed] = useState(false);

    // Tailwind CSS Toast feedback state
    const [toast, setToast] = useState(null);
    const toastTimerRef = useRef(null);
    const dataReqRef = useRef(0);
    const aiReqRef = useRef(0);

    const showToast = useCallback((type, title, message = '') => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        const id = Date.now();
        setToast({ id, type, title, message });
        toastTimerRef.current = setTimeout(() => {
            setToast((curr) => (curr?.id === id ? null : curr));
        }, 4500);
    }, []);

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        };
    }, []);

    const yearSelectOptions = useMemo(() => {
        if (Array.isArray(availableYears) && availableYears.length > 0) {
            return availableYears;
        }
        return [year, year - 1, year - 2];
    }, [availableYears, year]);

    // Fetch AI Strategic Analysis & ML Enrichment
    const fetchAiAnalysis = useCallback(
        async (overrideFilters = null, force = false) => {
            const reqId = ++aiReqRef.current;
            const activeYear = overrideFilters?.year ?? year;
            const activePeriod = overrideFilters?.period_type ?? periodType;
            const activeMonth = overrideFilters?.month ?? month;
            const activeQuarter = overrideFilters?.quarter ?? quarter;
            const activeSemester = overrideFilters?.semester ?? semester;
            const activeCustomer = overrideFilters?.customer ?? customer;

            setAiLoading(true);
            setAiError(null);
            setAiNotice(null);

            try {
                const csrfToken = getCsrfToken();
                const xsrfToken = getXsrfCookieToken();
                const response = await fetch('/marketing/performance/ai-analyze', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
                        ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        year: activeYear,
                        period_type: activePeriod,
                        month: activeMonth,
                        quarter: activeQuarter,
                        semester: activeSemester,
                        customer: activeCustomer,
                        force,
                    }),
                });

                if (reqId !== aiReqRef.current) return;

                if (!response.ok) {
                    throw new Error(`HTTP Error ${response.status}`);
                }

                const json = await response.json();
                if (reqId !== aiReqRef.current) return;

                if (json.success && json.data) {
                    setAiData(json.data);
                    setAiEngine(json.engine || 'AI Analytics Engine');
                    setAiIsFallback(Boolean(json.is_fallback));
                    setAiNotice(json.notice || null);

                    // Synchronize enriched ML customer badges/statuses back into KPI state
                    if (json.data.enriched_customers) {
                        const enriched = json.data.enriched_customers;
                        setData((prev) => {
                            if (!prev) return prev;
                            return {
                                ...prev,
                                allCustomers: enriched.allCustomers ?? prev.allCustomers,
                                topCustomers: enriched.topCustomers ?? prev.topCustomers,
                                lowestCustomers:
                                    enriched.lowestCustomers ?? prev.lowestCustomers,
                                decliningCustomers:
                                    enriched.decliningCustomers ?? prev.decliningCustomers,
                            };
                        });
                    }
                } else {
                    setAiError(json.notice || 'Gagal memuat analisis AI.');
                }
            } catch (error) {
                if (reqId !== aiReqRef.current) return;
                setAiError(`Tidak dapat terhubung ke layanan AI: ${error.message}`);
            } finally {
                if (reqId === aiReqRef.current) {
                    setAiLoading(false);
                }
            }
        },
        [year, periodType, month, quarter, semester, customer],
    );

    // Fetch KPI + Chart + Customer Lists
    const fetchData = useCallback(
        async (overrideFilters = null) => {
            const reqId = ++dataReqRef.current;
            setLoading(true);
            setAiData(null);

            const activeYear = overrideFilters?.year ?? year;
            const activePeriod = overrideFilters?.period_type ?? periodType;
            const activeMonth = overrideFilters?.month ?? month;
            const activeQuarter = overrideFilters?.quarter ?? quarter;
            const activeSemester = overrideFilters?.semester ?? semester;
            const activeCustomer = overrideFilters?.customer ?? customer;

            fetchAiAnalysis(overrideFilters);

            try {
                const params = new URLSearchParams({
                    year: String(activeYear),
                    period_type: activePeriod,
                    month: String(activeMonth),
                    quarter: String(activeQuarter),
                    semester: String(activeSemester),
                    customer: activeCustomer,
                });

                const response = await fetch(`/marketing/performance/data?${params.toString()}`, {
                    headers: { Accept: 'application/json' },
                    credentials: 'same-origin',
                });

                if (reqId !== dataReqRef.current) return;
                if (!response.ok) throw new Error(`HTTP Error ${response.status}`);

                const result = await response.json();
                if (reqId !== dataReqRef.current) return;
                setData(result);
            } catch (err) {
                if (reqId !== dataReqRef.current) return;
                showToast(
                    'error',
                    'Gagal Memuat Data Performa',
                    err?.message || 'Terjadi kesalahan saat mengambil data KPI penjualan.',
                );
            } finally {
                if (reqId === dataReqRef.current) {
                    setLoading(false);
                }
            }
        },
        [year, periodType, month, quarter, semester, customer, fetchAiAnalysis, showToast],
    );

    // Initial load on mount
    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Handlers
    const handleApplyFilter = (e) => {
        e.preventDefault();
        setCurrentPage(1);
        fetchData();
    };

    const handleResetFilter = () => {
        setYear(closedPeriodDefaults.year);
        setPeriodType(closedPeriodDefaults.period_type);
        setMonth(closedPeriodDefaults.month);
        setQuarter(closedPeriodDefaults.quarter);
        setSemester(closedPeriodDefaults.semester);
        setCustomer('all');
        setSearchCustomer('');
        setStatusFilter('all');
        setClusterFilter('all');
        setCurrentPage(1);
        fetchData(closedPeriodDefaults);
    };

    const handleBarClick = (item) => {
        if (!item) return;
        const val = Number(item.key);
        const overrides = { year, period_type: periodType, month, quarter, semester, customer };

        if (periodType === 'monthly') {
            setMonth(val);
            overrides.month = val;
        } else if (periodType === 'quarterly') {
            setQuarter(val);
            overrides.quarter = val;
        } else if (periodType === 'semester') {
            setSemester(val);
            overrides.semester = val;
        } else if (periodType === 'yearly') {
            setYear(val);
            overrides.year = val;
        }
        setCurrentPage(1);
        fetchData(overrides);
    };

    const handleExportPdf = () => {
        const params = new URLSearchParams({
            year: String(year),
            period_type: periodType,
            month: String(month),
            quarter: String(quarter),
            semester: String(semester),
            customer,
            format: 'pdf',
        });
        window.open(`/marketing/performance/export?${params.toString()}`, '_blank');
    };

    const handleCopyAiAnalysis = async () => {
        if (!aiData) return;
        const periodLbl = data?.periodInfo?.currentLabel || '-';
        const mlForecastNarrative = aiData?.ml_analytics?.forecast?.narrative || '';
        const mlChurnInfo = aiData?.ml_analytics?.churn;
        const quickWinLines = Array.isArray(aiData.quick_wins)
            ? aiData.quick_wins.map((q, idx) => `${idx + 1}. ${q}`).join('\n')
            : '';

        const lines = [
            `LAPORAN ANALISIS AI PERFORMA MARKETING`,
            `Periode: ${periodLbl}`,
            `Health Score: ${aiData.health_score ?? '-'} / 100 (${aiData.status_label || '-'})`,
            ``,
            `[RINGKASAN EKSEKUTIF]`,
            aiData.executive_summary || '-',
            ``,
            `[RISIKO PARETO]`,
            `Pangsa Top 5 Customer: ${aiData.pareto_risk_analysis?.top5_share_percent ?? 0}% (Risiko: ${aiData.pareto_risk_analysis?.risk_level || '-'})`,
            aiData.pareto_risk_analysis?.evaluation || '',
        ];

        if (mlForecastNarrative) {
            lines.push('', `[ML FORECASTING (HOLT-WINTERS)]`, mlForecastNarrative);
        }
        if (mlChurnInfo) {
            lines.push(
                '',
                `[ML CHURN EARLY WARNING]`,
                `Akun Risiko Tinggi: ${mlChurnInfo.high_risk_count ?? 0} | Omset Terancam: ${mlChurnInfo.value_at_risk_high_fmt || 'Rp 0'}`,
            );
        }
        if (quickWinLines) {
            lines.push('', `[QUICK WINS 7 HARI]`, quickWinLines);
        }

        const textToCopy = lines.join('\n');
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(textToCopy);
            } else {
                const ta = document.createElement('textarea');
                ta.value = textToCopy;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            setAiCopied(true);
            showToast('success', 'Laporan Disalin', 'Ringkasan analisis AI berhasil disalin ke clipboard.');
            setTimeout(() => setAiCopied(false), 2500);
        } catch {
            showToast('error', 'Gagal Menyalin', 'Browser tidak mengizinkan akses clipboard otomatis.');
        }
    };

    const getCustomerDetailUrl = useCallback(
        (kdCs) => {
            const params = new URLSearchParams({
                period_type: periodType,
                year: String(year),
                month: String(month),
                quarter: String(quarter),
                semester: String(semester),
            });
            return `/marketing/performance/customer/${encodeURIComponent(kdCs || '')}?${params.toString()}`;
        },
        [periodType, year, month, quarter, semester],
    );

    /* ─── Derived Metrics & Table Data ─── */

    const kpi = data?.kpi || {};
    const periodInfo = data?.periodInfo || {};
    const chartData = data?.chartData || {};
    const ml = aiData?.ml_analytics || data?.ml_analytics || null;
    const analyticsMetrics = aiData?.analytics_metrics || null;

    const availableClusters = useMemo(() => {
        const list = data?.allCustomers || [];
        const map = new Map();
        list.forEach((c) => {
            if (c.ml_cluster) {
                map.set(c.ml_cluster, (map.get(c.ml_cluster) || 0) + 1);
            }
        });
        return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
    }, [data]);

    const filteredCustomers = useMemo(() => {
        const list = data?.allCustomers || [];
        const q = searchCustomer.trim().toLowerCase();
        return list.filter((c) => {
            const matchesSearch =
                !q ||
                String(c.nm_cs || '').toLowerCase().includes(q) ||
                String(c.kd_cs || '').toLowerCase().includes(q);
            const matchesStatus = matchesStatusFilter(c, statusFilter);
            const matchesCluster = clusterFilter === 'all' || c.ml_cluster === clusterFilter;
            return matchesSearch && matchesStatus && matchesCluster;
        });
    }, [data, searchCustomer, statusFilter, clusterFilter]);

    const sortedCustomers = useMemo(() => {
        const arr = [...filteredCustomers];
        arr.sort((a, b) => {
            let valA;
            let valB;
            if (sortField === 'nm_cs') {
                valA = String(a.nm_cs || '').toLowerCase();
                valB = String(b.nm_cs || '').toLowerCase();
                return sortDirection === 'asc'
                    ? valA.localeCompare(valB)
                    : valB.localeCompare(valA);
            }
            if (sortField === 'status') {
                valA = String(a.ai_status || a.status || '').toLowerCase();
                valB = String(b.ai_status || b.status || '').toLowerCase();
                return sortDirection === 'asc'
                    ? valA.localeCompare(valB)
                    : valB.localeCompare(valA);
            }
            valA = Number(a[sortField] ?? 0);
            valB = Number(b[sortField] ?? 0);
            return sortDirection === 'asc' ? valA - valB : valB - valA;
        });
        return arr;
    }, [filteredCustomers, sortField, sortDirection]);

    const totalRows = sortedCustomers.length;
    const numericPerPage = perPage === 'all' ? Math.max(1, totalRows) : Number(perPage || 5);
    const totalPages = Math.max(1, Math.ceil(totalRows / numericPerPage));
    const safeCurrentPage = Math.min(currentPage, totalPages);

    const paginatedCustomers = useMemo(() => {
        if (perPage === 'all') return sortedCustomers;
        const startIdx = (safeCurrentPage - 1) * numericPerPage;
        return sortedCustomers.slice(startIdx, startIdx + numericPerPage);
    }, [sortedCustomers, perPage, safeCurrentPage, numericPerPage]);

    const paginationPages = useMemo(() => {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        const pages = [1];
        const left = Math.max(2, safeCurrentPage - 1);
        const right = Math.min(totalPages - 1, safeCurrentPage + 1);
        if (left > 2) pages.push('...');
        for (let p = left; p <= right; p++) pages.push(p);
        if (right < totalPages - 1) pages.push('...');
        pages.push(totalPages);
        return pages;
    }, [totalPages, safeCurrentPage]);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDirection(field === 'rank' || field === 'nm_cs' ? 'asc' : 'desc');
        }
        setCurrentPage(1);
    };

    const renderSortIcon = (field) => {
        if (sortField !== field) {
            return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
        }
        return sortDirection === 'asc' ? (
            <ChevronUp className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
            <ChevronDown className="h-3.5 w-3.5 text-emerald-500" />
        );
    };

    const lowestListData =
        lowestMode === 'drop' ? data?.decliningCustomers || [] : data?.lowestCustomers || [];

    const growthPercentNum = Number(kpi.growth_percent || 0);
    const growthNominalNum = Number(kpi.growth_nominal || 0);
    const isPositiveGrowth = growthPercentNum >= 0;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Analitik Performa Marketing" />

            {/* Floating Tailwind + Motion Toast (No SweetAlert) */}
            <TopRightToast toast={toast} onClose={() => setToast(null)} />

            <div className="mx-auto w-full max-w-[1600px] space-y-6 p-3 sm:p-5 lg:p-6">
                {/* ════════════════════════════════════════════════════════════════
                    1. COSMOS COMMAND HERO & INTEGRATED GLASSMORPHIC FILTER DOCK
                ════════════════════════════════════════════════════════════════ */}
                <motion.section
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="relative overflow-hidden rounded-3xl border border-slate-800/90 bg-[#0b1220] p-4 text-white shadow-xl sm:p-6 lg:p-7"
                >
                    <CosmosHeroOrnaments />

                    <div className="relative z-10 space-y-5">
                        {/* Top Telemetry Row & Primary CTAs */}
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                                        <Sparkles className="h-3.5 w-3.5" />
                                        Marketing Intelligence Command
                                    </span>
                                    {periodInfo.currentLabel && (
                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/12 px-3 py-1 text-[11px] font-semibold text-cyan-200">
                                            <Calendar className="h-3 w-3" />
                                            <span>{periodInfo.currentLabel}</span>
                                            {periodInfo.previousLabel && (
                                                <span className="text-slate-400">
                                                    vs {periodInfo.previousLabel}
                                                </span>
                                            )}
                                        </span>
                                    )}
                                </div>

                                <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                                    Performa Penjualan{' '}
                                    <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-sky-300 bg-clip-text text-transparent">
                                        &amp; Retensi Customer
                                    </span>
                                </h1>
                                <p className="max-w-2xl text-xs leading-relaxed text-slate-300 sm:text-sm">
                                    Pantau realisasi faktur penjualan, konsentrasi Pareto, proyeksi deret waktu Holt-Winters, dan peringatan dini risiko churn pelanggan dalam satu layar terpadu.
                                </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap items-center gap-2.5">
                                <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => fetchData()}
                                    disabled={loading}
                                    className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-3.5 py-2 text-xs font-semibold text-slate-100 transition-colors hover:bg-white/15 disabled:opacity-50 sm:text-sm"
                                >
                                    <RefreshCw
                                        className={`h-4 w-4 text-emerald-300 ${loading ? 'animate-spin' : ''}`}
                                    />
                                    <span>Segarkan Data</span>
                                </motion.button>

                                <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={handleExportPdf}
                                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-md transition-all hover:brightness-110 sm:text-sm"
                                >
                                    <Download className="h-4 w-4" />
                                    <span>Ekspor / Cetak PDF</span>
                                </motion.button>
                            </div>
                        </div>

                        {/* Glassmorphic Command Filter Dock */}
                        <form
                            onSubmit={handleApplyFilter}
                            className="rounded-2xl border border-white/10 bg-slate-900/85 p-3.5 shadow-inner sm:p-4"
                        >
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
                                {/* Tahun */}
                                <div className="lg:col-span-2">
                                    <label
                                        htmlFor="perf-filter-year"
                                        className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300"
                                    >
                                        <Calendar className="h-3 w-3 text-emerald-400" />
                                        Tahun
                                    </label>
                                    <select
                                        id="perf-filter-year"
                                        value={year}
                                        onChange={(e) => setYear(Number(e.target.value))}
                                        className="h-9 w-full rounded-xl border border-white/15 bg-slate-950 px-3 text-xs font-semibold text-white outline-none focus:border-emerald-400 sm:text-sm"
                                    >
                                        {yearSelectOptions.map((y) => (
                                            <option key={y} value={y} className="bg-slate-950 text-white">
                                                {y}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Mode Periode (Spring Pill Switcher) */}
                                <div className="sm:col-span-2 lg:col-span-4">
                                    <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                                        <Layers className="h-3 w-3 text-cyan-400" />
                                        Mode Periode
                                    </span>
                                    <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-slate-950/90 p-1 sm:grid-cols-4">
                                        {periodModeTabs.map((tab) => {
                                            const active = periodType === tab.value;
                                            return (
                                                <button
                                                    key={tab.value}
                                                    type="button"
                                                    onClick={() => setPeriodType(tab.value)}
                                                    className={`relative rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
                                                        active
                                                            ? 'text-slate-950'
                                                            : 'text-slate-300 hover:text-white'
                                                    }`}
                                                >
                                                    {active && (
                                                        <motion.span
                                                            layoutId="periodModePill"
                                                            transition={{
                                                                type: 'spring',
                                                                stiffness: 420,
                                                                damping: 32,
                                                            }}
                                                            className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-400 to-cyan-400"
                                                        />
                                                    )}
                                                    <span className="relative z-10">{tab.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Sub-Periode Dinamis */}
                                <div className="lg:col-span-2">
                                    <label
                                        htmlFor="perf-filter-subperiod"
                                        className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300"
                                    >
                                        <Clock className="h-3 w-3 text-sky-400" />
                                        {periodType === 'monthly'
                                            ? 'Bulan'
                                            : periodType === 'quarterly'
                                              ? 'Triwulan'
                                              : periodType === 'semester'
                                                ? 'Semester'
                                                : 'Rentang'}
                                    </label>
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={periodType}
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -6 }}
                                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                        >
                                            {periodType === 'monthly' && (
                                                <select
                                                    id="perf-filter-subperiod"
                                                    value={month}
                                                    onChange={(e) => setMonth(Number(e.target.value))}
                                                    className="h-9 w-full rounded-xl border border-white/15 bg-slate-950 px-3 text-xs font-semibold text-white outline-none transition-colors focus:border-emerald-400 sm:text-sm"
                                                >
                                                    {monthOptions.map((m) => (
                                                        <option
                                                            key={m.value}
                                                            value={m.value}
                                                            className="bg-slate-950 text-white"
                                                        >
                                                            {m.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                            {periodType === 'quarterly' && (
                                                <select
                                                    id="perf-filter-subperiod"
                                                    value={quarter}
                                                    onChange={(e) => setQuarter(Number(e.target.value))}
                                                    className="h-9 w-full rounded-xl border border-white/15 bg-slate-950 px-3 text-xs font-semibold text-white outline-none transition-colors focus:border-emerald-400 sm:text-sm"
                                                >
                                                    {quarterOptions.map((q) => (
                                                        <option
                                                            key={q.value}
                                                            value={q.value}
                                                            className="bg-slate-950 text-white"
                                                        >
                                                            {q.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                            {periodType === 'semester' && (
                                                <select
                                                    id="perf-filter-subperiod"
                                                    value={semester}
                                                    onChange={(e) => setSemester(Number(e.target.value))}
                                                    className="h-9 w-full rounded-xl border border-white/15 bg-slate-950 px-3 text-xs font-semibold text-white outline-none transition-colors focus:border-emerald-400 sm:text-sm"
                                                >
                                                    {semesterOptions.map((s) => (
                                                        <option
                                                            key={s.value}
                                                            value={s.value}
                                                            className="bg-slate-950 text-white"
                                                        >
                                                            {s.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                            {periodType === 'yearly' && (
                                                <div className="flex h-9 items-center rounded-xl border border-white/10 bg-slate-950/60 px-3 text-xs font-medium text-slate-400">
                                                    Satu Tahun Penuh ({year})
                                                </div>
                                            )}
                                        </motion.div>
                                    </AnimatePresence>
                                </div>

                                {/* Customer Filter */}
                                <div className="lg:col-span-2">
                                    <label
                                        htmlFor="perf-filter-customer"
                                        className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300"
                                    >
                                        <Building2 className="h-3 w-3 text-indigo-400" />
                                        Customer
                                    </label>
                                    <select
                                        id="perf-filter-customer"
                                        value={customer}
                                        onChange={(e) => setCustomer(e.target.value)}
                                        className="h-9 w-full rounded-xl border border-white/15 bg-slate-950 px-3 text-xs font-semibold text-white outline-none transition-colors focus:border-emerald-400 sm:text-sm"
                                    >
                                        <option value="all" className="bg-slate-950 text-white">
                                            Semua Customer
                                        </option>
                                        {customersList.map((c) => (
                                            <option
                                                key={c.kd_cs}
                                                value={c.kd_cs}
                                                className="bg-slate-950 text-white"
                                            >
                                                {c.nm_cs}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Submit / Reset Actions */}
                                <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-2">
                                    <motion.div
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.97 }}
                                        className="flex-1"
                                    >
                                        <Button
                                            type="submit"
                                            disabled={loading}
                                            className="h-9 w-full rounded-xl bg-emerald-500 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                                        >
                                            <Filter className="mr-1.5 h-3.5 w-3.5" />
                                            Tampilkan
                                        </Button>
                                    </motion.div>
                                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.94 }}>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleResetFilter}
                                            disabled={loading}
                                            title="Reset ke periode tutup buku terakhir"
                                            className="h-9 shrink-0 rounded-xl border-white/15 bg-white/5 px-3 text-xs font-semibold text-slate-200 hover:bg-white/15 hover:text-white"
                                        >
                                            <RotateCcw className="h-3.5 w-3.5" />
                                        </Button>
                                    </motion.div>
                                </div>
                            </div>
                        </form>
                    </div>
                </motion.section>

                {/* ════════════════════════════════════════════════════════════════
                    2. 5-CARD BENTO KPI SUMMARY MATRIX
                ════════════════════════════════════════════════════════════════ */}
                <section
                    aria-label="Ringkasan KPI Penjualan"
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
                >
                    <KpiBentoCard
                        index={0}
                        loading={loading && !data}
                        title="Total Penjualan"
                        value={formatRupiah(kpi.total_sales)}
                        accentClass="bg-gradient-to-r from-emerald-500 to-cyan-500"
                        icon={Banknote}
                        iconBgClass="bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                        subtitle={
                            <span>
                                {periodInfo.previousLabel || 'Periode lalu'}:{' '}
                                <strong className="text-foreground tabular-nums">
                                    {formatCompactRupiah(kpi.prev_total_sales)}
                                </strong>
                            </span>
                        }
                    />

                    <KpiBentoCard
                        index={1}
                        loading={loading && !data}
                        title="Customer Bertransaksi"
                        value={`${formatNumber(kpi.total_customers)} Akun`}
                        accentClass="bg-gradient-to-r from-indigo-500 to-cyan-500"
                        icon={Users}
                        iconBgClass="bg-indigo-500/12 text-indigo-600 dark:text-indigo-400"
                        subtitle={
                            <span>
                                Periode sebelumnya:{' '}
                                <strong className="text-foreground tabular-nums">
                                    {formatNumber(kpi.prev_total_customers)} akun
                                </strong>
                            </span>
                        }
                    />

                    <KpiBentoCard
                        index={2}
                        loading={loading && !data}
                        title="Pertumbuhan Penjualan"
                        value={formatPercent(growthPercentNum)}
                        accentClass={
                            isPositiveGrowth
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                : 'bg-gradient-to-r from-rose-500 to-orange-500'
                        }
                        icon={isPositiveGrowth ? TrendingUp : TrendingDown}
                        iconBgClass={
                            isPositiveGrowth
                                ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-500/12 text-rose-600 dark:text-rose-400'
                        }
                        badge={
                            <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums ${
                                    isPositiveGrowth
                                        ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                                        : 'bg-rose-500/12 text-rose-700 dark:text-rose-300'
                                }`}
                            >
                                {growthNominalNum >= 0 ? (
                                    <ArrowUpRight className="h-3 w-3" />
                                ) : (
                                    <ArrowDownRight className="h-3 w-3" />
                                )}
                                {growthNominalNum >= 0 ? 'Naik' : 'Turun'}{' '}
                                {formatCompactRupiah(Math.abs(growthNominalNum))}
                            </span>
                        }
                        subtitle={
                            <span>
                                Selisih nominal vs {periodInfo.previousLabel || 'periode lalu'}
                            </span>
                        }
                    />

                    <KpiBentoCard
                        index={3}
                        loading={loading && !data}
                        title="Total Faktur Terbit"
                        value={`${formatNumber(kpi.total_invoices)} Invoice`}
                        accentClass="bg-gradient-to-r from-amber-500 to-orange-500"
                        icon={FileText}
                        iconBgClass="bg-amber-500/12 text-amber-600 dark:text-amber-400"
                        subtitle={
                            <span>
                                Periode lalu:{' '}
                                <strong className="text-foreground tabular-nums">
                                    {formatNumber(kpi.prev_total_invoices)} invoice
                                </strong>
                            </span>
                        }
                    />

                    <KpiBentoCard
                        index={4}
                        loading={loading && !data}
                        title="Customer Tertinggi"
                        value={kpi.top_customer?.name || '-'}
                        accentClass="bg-gradient-to-r from-violet-500 to-amber-500"
                        icon={Crown}
                        iconBgClass="bg-amber-500/12 text-amber-600 dark:text-amber-400"
                        badge={
                            kpi.top_customer ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/12 px-2.5 py-0.5 text-[11px] font-bold text-violet-700 tabular-nums dark:text-violet-300">
                                    {formatCompactRupiah(kpi.top_customer.sales)} &bull;{' '}
                                    {Number(kpi.top_customer.contribution || 0).toFixed(1)}%
                                </span>
                            ) : null
                        }
                        subtitle={<span>Kontributor omset utama periode aktif</span>}
                    />
                </section>

                {/* ════════════════════════════════════════════════════════════════
                    3. AI STRATEGIC INTELLIGENCE & MACHINE LEARNING COMMAND HUB
                ════════════════════════════════════════════════════════════════ */}
                <motion.section
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden rounded-3xl border border-slate-800/80 bg-[#0d1526] text-slate-100 shadow-lg"
                >
                    {/* AI Command Header Strip */}
                    <div className="flex flex-col gap-4 border-b border-white/10 bg-gradient-to-r from-slate-900 via-[#0f1c33] to-slate-900 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
                        <div className="flex items-start gap-3.5">
                            <AiEngineCoreBadge loading={aiLoading} />
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-base font-extrabold tracking-tight text-white sm:text-lg">
                                        AI Strategic Insights &amp; ML Telemetry
                                    </h2>
                                    <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/8 px-2.5 py-0.5 text-[10.5px] font-semibold text-cyan-300">
                                        <Cpu className="h-3 w-3" />
                                        {aiEngine}
                                    </span>
                                    {aiIsFallback && (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-500/15 px-2.5 py-0.5 text-[10.5px] font-semibold text-amber-300">
                                            Python Fallback Mode
                                        </span>
                                    )}
                                </div>
                                <p className="mt-1 text-xs text-slate-300">
                                    Diagnosa Pareto, Indeks HHI/Gini, Prediksi Omset Holt-Winters, Churn Early Warning &amp; Rekomendasi Taktis
                                </p>
                            </div>
                        </div>

                        {/* AI Toolbar Controls */}
                        <div className="flex flex-wrap items-center gap-2">
                            {aiData && (
                                <button
                                    type="button"
                                    onClick={handleCopyAiAnalysis}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-semibold text-slate-100 transition-colors hover:bg-white/15"
                                >
                                    {aiCopied ? (
                                        <>
                                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                                            <span>Tersalin</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="h-3.5 w-3.5 text-cyan-300" />
                                            <span>Salin Laporan</span>
                                        </>
                                    )}
                                </button>
                            )}

                            <motion.button
                                type="button"
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.96 }}
                                onClick={() => fetchAiAnalysis(null, true)}
                                disabled={aiLoading}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
                            >
                                <RefreshCw
                                    className={`h-3.5 w-3.5 ${aiLoading ? 'animate-spin' : ''}`}
                                />
                                <span>Analisis Ulang</span>
                            </motion.button>

                            <motion.button
                                type="button"
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.96 }}
                                onClick={() => setAiCollapsed((c) => !c)}
                                aria-expanded={!aiCollapsed}
                                className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/15 hover:text-white"
                            >
                                <span>{aiCollapsed ? 'Tampilkan' : 'Ringkas'}</span>
                                <motion.span
                                    animate={{ rotate: aiCollapsed ? 180 : 0 }}
                                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                                    className="inline-flex items-center"
                                >
                                    <ChevronUp className="h-4 w-4" />
                                </motion.span>
                            </motion.button>
                        </div>
                    </div>

                    {/* Collapsible AI Body */}
                    <AnimatePresence initial={false}>
                        {!aiCollapsed && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                className="overflow-hidden"
                            >
                                <div className="space-y-5 p-4 sm:p-6">
                                    {/* Engine Notice Banner */}
                                    {aiNotice && (
                                        <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/35 bg-amber-500/12 px-3.5 py-2.5 text-xs text-amber-200">
                                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                                            <span>{aiNotice}</span>
                                        </div>
                                    )}

                                    {/* Error Banner */}
                                    {aiError && !aiLoading && (
                                        <div className="flex flex-col gap-3 rounded-2xl border border-rose-500/35 bg-rose-500/12 p-4 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex items-start gap-2.5 text-xs text-rose-200">
                                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                                                <span>{aiError}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => fetchAiAnalysis(null, true)}
                                                className="shrink-0 self-start rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-400 sm:self-auto"
                                            >
                                                Coba Lagi
                                            </button>
                                        </div>
                                    )}

                                    {/* Loading Telemetry Skeleton */}
                                    {aiLoading && !aiData && (
                                        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-slate-900/70 px-6 py-10 text-center">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                                                <Sparkles className="h-6 w-6 animate-pulse" />
                                            </div>
                                            <p className="text-sm font-semibold text-white">
                                                Memproses Analitik Kuantitatif &amp; Machine Learning...
                                            </p>
                                            <p className="max-w-lg text-xs text-slate-400">
                                                Menjalankan regresi deret waktu Holt-Winters, segmentasi pelanggan K-Means, serta skor risiko churn dan konsentrasi HHI.
                                            </p>
                                        </div>
                                    )}

                                    {/* Full Loaded AI & ML Content */}
                                    {aiData && (
                                        <>
                                            {/* Row A: Health Score + Executive Summary + Quantitative Metrics + Pareto */}
                                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                                                {/* Health Score & Executive Summary (7 cols) */}
                                                <div className="flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900/75 p-4 lg:col-span-7 sm:p-5">
                                                    <HealthScoreGauge
                                                        score={aiData.health_score}
                                                        statusLabel={aiData.status_label}
                                                    />

                                                    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3.5">
                                                        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                                                            <Sparkles className="h-3.5 w-3.5" />
                                                            Ringkasan Eksekutif AI
                                                        </div>
                                                        <p className="text-xs leading-relaxed text-slate-200 sm:text-sm">
                                                            {aiData.executive_summary || '-'}
                                                        </p>
                                                    </div>

                                                    {/* Python Quantitative Metrics Micro Grid */}
                                                    {analyticsMetrics && (
                                                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                                                            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-2.5">
                                                                <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                                                    Indeks HHI
                                                                </span>
                                                                <span className="mt-0.5 block text-sm font-extrabold text-white tabular-nums">
                                                                    {formatNumber(analyticsMetrics.hhi)}
                                                                </span>
                                                                <span className="text-[10px] text-cyan-300">
                                                                    {analyticsMetrics.risk_level || analyticsMetrics.hhi_label}
                                                                </span>
                                                            </div>
                                                            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-2.5">
                                                                <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                                                    Koefisien Gini
                                                                </span>
                                                                <span className="mt-0.5 block text-sm font-extrabold text-white tabular-nums">
                                                                    {Number(analyticsMetrics.gini || 0).toFixed(3)}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400">
                                                                    Ketimpangan
                                                                </span>
                                                            </div>
                                                            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-2.5">
                                                                <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                                                    Retention (NRR)
                                                                </span>
                                                                <span className="mt-0.5 block text-sm font-extrabold text-emerald-400 tabular-nums">
                                                                    {Number(analyticsMetrics.nrr_percent || 0).toFixed(1)}%
                                                                </span>
                                                                <span className="text-[10px] text-slate-400">
                                                                    Net Revenue
                                                                </span>
                                                            </div>
                                                            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-2.5">
                                                                <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                                                    Churn Rate
                                                                </span>
                                                                <span className="mt-0.5 block text-sm font-extrabold text-rose-400 tabular-nums">
                                                                    {Number(analyticsMetrics.churn_rate_percent || 0).toFixed(1)}%
                                                                </span>
                                                                <span className="text-[10px] text-slate-400">
                                                                    Pareto 80%: {analyticsMetrics.pareto_80_cutoff_customers ?? '-'} akun
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Pareto Concentration Radar (5 cols) */}
                                                <div className="flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900/75 p-4 lg:col-span-5 sm:p-5">
                                                    <div>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
                                                                <ShieldAlert className="h-4 w-4" />
                                                                Risiko Konsentrasi Pareto
                                                            </span>
                                                            <span className="rounded-full border border-amber-400/35 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                                                                Risiko:{' '}
                                                                {aiData.pareto_risk_analysis?.risk_level || '-'}
                                                            </span>
                                                        </div>

                                                        <div className="mt-4 flex items-baseline justify-between">
                                                            <span className="text-xs text-slate-300">
                                                                Pangsa Top 5 Customer
                                                            </span>
                                                            <span className="text-2xl font-extrabold text-white tabular-nums">
                                                                {Number(
                                                                    aiData.pareto_risk_analysis
                                                                        ?.top5_share_percent || 0,
                                                                ).toFixed(1)}
                                                                %
                                                            </span>
                                                        </div>

                                                        {/* Animated Progress Bar */}
                                                        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-800">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{
                                                                    width: `${Math.min(
                                                                        100,
                                                                        Number(
                                                                            aiData.pareto_risk_analysis
                                                                                ?.top5_share_percent || 0,
                                                                        ),
                                                                    )}%`,
                                                                }}
                                                                transition={{
                                                                    duration: 0.9,
                                                                    ease: [0.16, 1, 0.3, 1],
                                                                }}
                                                                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3.5 text-xs leading-relaxed text-slate-200">
                                                        {aiData.pareto_risk_analysis?.evaluation ||
                                                            'Evaluasi distribusi Pareto omset pelanggan sedang tersedia.'}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Row B: Machine Learning Forecasting, Churn Early Warning & K-Means Segmentation */}
                                            {ml && (
                                                <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                                                    {/* Holt-Winters Forecast (7 cols) */}
                                                    <div className="rounded-2xl border border-cyan-500/25 bg-slate-900/75 p-4 xl:col-span-7 sm:p-5">
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <TrendingUp className="h-4 w-4 text-cyan-400" />
                                                                <h3 className="text-sm font-bold text-white">
                                                                    Prediksi Omset (Holt-Winters Time-Series)
                                                                </h3>
                                                            </div>
                                                            {ml.forecast?.model_metrics?.mape != null && (
                                                                <span className="rounded-full border border-cyan-400/35 bg-cyan-500/15 px-2.5 py-0.5 text-[11px] font-bold text-cyan-300 tabular-nums">
                                                                    MAPE: {ml.forecast.model_metrics.mape}%
                                                                </span>
                                                            )}
                                                        </div>

                                                        {ml.forecast?.narrative && (
                                                            <p className="mt-2.5 text-xs leading-relaxed text-slate-300">
                                                                {ml.forecast.narrative}
                                                            </p>
                                                        )}

                                                        {Array.isArray(ml.forecast?.forecast_periods) &&
                                                            ml.forecast.forecast_periods.length > 0 && (
                                                                <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                                                                    {ml.forecast.forecast_periods.map(
                                                                        (fp, fIdx) => {
                                                                            const fpGrowth = Number(
                                                                                fp.growth_pct || 0,
                                                                            );
                                                                            return (
                                                                                <motion.div
                                                                                    key={fIdx}
                                                                                    initial={{ opacity: 0, y: 12 }}
                                                                                    animate={{ opacity: 1, y: 0 }}
                                                                                    transition={{
                                                                                        duration: 0.35,
                                                                                        delay: fIdx * 0.08,
                                                                                        ease: [0.16, 1, 0.3, 1],
                                                                                    }}
                                                                                    whileHover={{ y: -2 }}
                                                                                    className="rounded-xl border border-white/10 bg-slate-950/70 p-3 transition-colors hover:border-cyan-400/35"
                                                                                >
                                                                                    <div className="flex items-center justify-between gap-1 text-[11px] font-semibold text-slate-400">
                                                                                        <span>
                                                                                            {fp.period_label}
                                                                                        </span>
                                                                                        <span
                                                                                            className={`font-bold tabular-nums ${
                                                                                                fpGrowth >= 0
                                                                                                    ? 'text-emerald-400'
                                                                                                    : 'text-rose-400'
                                                                                            }`}
                                                                                        >
                                                                                            {fpGrowth > 0 ? '+' : ''}
                                                                                            {fpGrowth.toFixed(1)}%
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="mt-1 text-base font-extrabold text-white tabular-nums">
                                                                                        {formatCompactRupiah(
                                                                                            fp.predicted_sales,
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="mt-0.5 text-[10px] text-slate-400 tabular-nums">
                                                                                        95% CI:{' '}
                                                                                        {formatCompactRupiah(
                                                                                            fp.lower_bound_95,
                                                                                        )}{' '}
                                                                                        -{' '}
                                                                                        {formatCompactRupiah(
                                                                                            fp.upper_bound_95,
                                                                                        )}
                                                                                    </div>
                                                                                </motion.div>
                                                                            );
                                                                        },
                                                                    )}
                                                                </div>
                                                            )}
                                                    </div>

                                                    {/* Churn Early Warning (5 cols) */}
                                                    <div className="rounded-2xl border border-rose-500/25 bg-slate-900/75 p-4 xl:col-span-5 sm:p-5">
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <ShieldAlert className="h-4 w-4 text-rose-400" />
                                                                <h3 className="text-sm font-bold text-white">
                                                                    Churn Early Warning
                                                                </h3>
                                                            </div>
                                                            <span className="rounded-full border border-rose-400/35 bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-bold text-rose-300 tabular-nums">
                                                                Terancam:{' '}
                                                                {ml.churn?.value_at_risk_high_fmt ||
                                                                    'Rp 0'}
                                                            </span>
                                                        </div>

                                                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                                            <span className="rounded-lg border border-rose-500/30 bg-rose-500/12 px-2.5 py-1 font-semibold text-rose-200 tabular-nums">
                                                                Risiko Tinggi:{' '}
                                                                {ml.churn?.high_risk_count ?? 0} Akun
                                                            </span>
                                                            <span className="rounded-lg border border-amber-500/30 bg-amber-500/12 px-2.5 py-1 font-semibold text-amber-200 tabular-nums">
                                                                Risiko Sedang:{' '}
                                                                {ml.churn?.medium_risk_count ?? 0} Akun
                                                            </span>
                                                        </div>

                                                        <div className="mt-3 space-y-2">
                                                            {(ml.churn?.top_at_risk_accounts || [])
                                                                .length === 0 ? (
                                                                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                                                                    Tidak terdeteksi customer berisiko tinggi churn pada periode ini.
                                                                </div>
                                                            ) : (
                                                                ml.churn.top_at_risk_accounts
                                                                    .slice(0, 3)
                                                                    .map((acc, aIdx) => (
                                                                        <motion.div
                                                                            key={`${acc.kd_cs}-${aIdx}`}
                                                                            initial={{ opacity: 0, x: -10 }}
                                                                            animate={{ opacity: 1, x: 0 }}
                                                                            transition={{
                                                                                duration: 0.3,
                                                                                delay: aIdx * 0.06,
                                                                                ease: [0.16, 1, 0.3, 1],
                                                                            }}
                                                                            whileHover={{ x: 3 }}
                                                                        >
                                                                            <Link
                                                                                href={getCustomerDetailUrl(
                                                                                    acc.kd_cs,
                                                                                )}
                                                                                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/65 px-3 py-2 transition-colors hover:border-rose-400/40"
                                                                            >
                                                                                <div className="min-w-0">
                                                                                    <div className="truncate text-xs font-bold text-white">
                                                                                        {acc.nm_cs}
                                                                                    </div>
                                                                                    <div className="truncate text-[10.5px] text-slate-400">
                                                                                        {acc.risk_factor}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="shrink-0 text-right">
                                                                                    <span className="block text-xs font-extrabold text-rose-400 tabular-nums">
                                                                                        {Math.round(
                                                                                            Number(
                                                                                                acc.churn_prob ||
                                                                                                    0,
                                                                                            ) * 100,
                                                                                        )}
                                                                                        %
                                                                                    </span>
                                                                                    <span className="text-[10px] text-slate-400 tabular-nums">
                                                                                        {acc.prev_sales_fmt}
                                                                                    </span>
                                                                                </div>
                                                                            </Link>
                                                                        </motion.div>
                                                                    ))
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* K-Means Cluster Interactive Quick Filter Strip */}
                                            {ml?.clusters && Object.keys(ml.clusters).length > 0 && (
                                                <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-4">
                                                    <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                                                        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-300">
                                                            <Layers className="h-3.5 w-3.5" />
                                                            Segmentasi K-Means Customer (Klik untuk Filter Tabel)
                                                        </span>
                                                        {clusterFilter !== 'all' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setClusterFilter('all');
                                                                    setCurrentPage(1);
                                                                }}
                                                                className="text-[11px] font-semibold text-cyan-300 hover:underline"
                                                            >
                                                                Reset Segmen ({clusterFilter})
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {Object.entries(ml.clusters).map(
                                                            ([cName, info]) => {
                                                                const selected =
                                                                    clusterFilter === cName;
                                                                return (
                                                                    <motion.button
                                                                        key={cName}
                                                                        type="button"
                                                                        whileHover={{ scale: 1.04 }}
                                                                        whileTap={{ scale: 0.96 }}
                                                                        onClick={() => {
                                                                            setClusterFilter(
                                                                                selected
                                                                                    ? 'all'
                                                                                    : cName,
                                                                            );
                                                                            setCurrentPage(1);
                                                                        }}
                                                                        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                                                            selected
                                                                                ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200 ring-2 ring-emerald-400/25'
                                                                                : 'border-white/15 bg-slate-950/60 text-slate-200 hover:border-cyan-400/40 hover:text-white'
                                                                        }`}
                                                                    >
                                                                        <span>{cName}</span>
                                                                        <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                                                                            {info.count ?? 0}
                                                                        </span>
                                                                    </motion.button>
                                                                );
                                                            },
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Row C: Critical Areas + Tactical Playbook + Quick Wins */}
                                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                                                {/* Critical Areas */}
                                                <motion.div
                                                    initial={{ opacity: 0, y: 14 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ duration: 0.4, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
                                                    className="rounded-2xl border border-rose-500/25 bg-slate-900/75 p-4"
                                                >
                                                    <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-300">
                                                        <AlertTriangle className="h-4 w-4" />
                                                        Area Kritis &amp; Anomali (Z-Score)
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        {(aiData.critical_areas_to_fix || []).length ===
                                                        0 ? (
                                                            <p className="text-xs text-slate-400">
                                                                Tidak ada anomali kritis terdeteksi pada periode ini.
                                                            </p>
                                                        ) : (
                                                            aiData.critical_areas_to_fix.map(
                                                                (item, idx) => (
                                                                    <motion.div
                                                                        key={idx}
                                                                        initial={{ opacity: 0, x: -8 }}
                                                                        animate={{ opacity: 1, x: 0 }}
                                                                        transition={{ duration: 0.3, delay: idx * 0.06 }}
                                                                        whileHover={{ x: 2 }}
                                                                        className="rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs transition-colors hover:border-rose-400/35"
                                                                    >
                                                                        <div className="flex flex-wrap items-center justify-between gap-1 font-bold text-rose-300">
                                                                            <span>{item.issue}</span>
                                                                            <span className="tabular-nums text-[11px] text-rose-200">
                                                                                {item.nominal_impact}
                                                                            </span>
                                                                        </div>
                                                                        <div className="mt-1 font-semibold text-white">
                                                                            {item.customer_affected}
                                                                        </div>
                                                                        <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                                                                            {item.root_cause}
                                                                        </p>
                                                                        <div className="mt-2 rounded-lg bg-rose-500/12 px-2.5 py-1.5 text-[11px] font-medium text-rose-200">
                                                                            Aksi: {item.action_to_fix}
                                                                        </div>
                                                                    </motion.div>
                                                                ),
                                                            )
                                                        )}
                                                    </div>
                                                </motion.div>

                                                {/* Tactical Recommendations */}
                                                <motion.div
                                                    initial={{ opacity: 0, y: 14 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ duration: 0.4, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
                                                    className="rounded-2xl border border-indigo-500/25 bg-slate-900/75 p-4"
                                                >
                                                    <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-300">
                                                        <Target className="h-4 w-4" />
                                                        Rekomendasi Taktis Divisi
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        {(aiData.tactical_recommendations || [])
                                                            .length === 0 ? (
                                                            <p className="text-xs text-slate-400">
                                                                Menunggu data rekomendasi taktis...
                                                            </p>
                                                        ) : (
                                                            aiData.tactical_recommendations.map(
                                                                (rec, idx) => (
                                                                    <motion.div
                                                                        key={idx}
                                                                        initial={{ opacity: 0, x: -8 }}
                                                                        animate={{ opacity: 1, x: 0 }}
                                                                        transition={{ duration: 0.3, delay: idx * 0.06 }}
                                                                        whileHover={{ x: 2 }}
                                                                        className="rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs transition-colors hover:border-indigo-400/35"
                                                                    >
                                                                        <span className="inline-block rounded-md bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                                                                            {rec.category}
                                                                        </span>
                                                                        <div className="mt-1.5 font-bold text-white">
                                                                            {rec.focus}
                                                                        </div>
                                                                        <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                                                                            {rec.action}
                                                                        </p>
                                                                    </motion.div>
                                                                ),
                                                            )
                                                        )}
                                                    </div>
                                                </motion.div>

                                                {/* 7-Day Quick Wins */}
                                                <motion.div
                                                    initial={{ opacity: 0, y: 14 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ duration: 0.4, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
                                                    className="rounded-2xl border border-emerald-500/25 bg-slate-900/75 p-4"
                                                >
                                                    <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
                                                        <Zap className="h-4 w-4" />
                                                        Quick Wins 7 Hari Ke Depan
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        {(aiData.quick_wins || []).length === 0 ? (
                                                            <p className="text-xs text-slate-400">
                                                                Belum ada daftar quick wins.
                                                            </p>
                                                        ) : (
                                                            aiData.quick_wins.map((qw, idx) => (
                                                                <motion.div
                                                                    key={idx}
                                                                    initial={{ opacity: 0, x: -8 }}
                                                                    animate={{ opacity: 1, x: 0 }}
                                                                    transition={{ duration: 0.3, delay: idx * 0.06 }}
                                                                    whileHover={{ x: 2 }}
                                                                    className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs transition-colors hover:border-emerald-400/35"
                                                                >
                                                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] font-extrabold text-emerald-300 tabular-nums">
                                                                        {idx + 1}
                                                                    </span>
                                                                    <span className="leading-relaxed text-slate-200">
                                                                        {qw}
                                                                    </span>
                                                                </motion.div>
                                                            ))
                                                        )}
                                                    </div>
                                                </motion.div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.section>

                {/* ════════════════════════════════════════════════════════════════
                    4. INTERACTIVE SALES TIME-SERIES SVG CHART
                ════════════════════════════════════════════════════════════════ */}
                <SalesChartPanel
                    chartData={chartData}
                    loading={loading}
                    periodType={periodType}
                    hoveredChartItem={hoveredChartItem}
                    setHoveredChartItem={setHoveredChartItem}
                    onBarClick={handleBarClick}
                />

                {/* ════════════════════════════════════════════════════════════════
                    5. TOP 5 PERFORMANCE BENTO DUEL (HIGHEST vs WATCHLIST)
                ════════════════════════════════════════════════════════════════ */}
                <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    <LeaderboardBentoCard
                        variant="highest"
                        title="Top 5 Penjualan Tertinggi"
                        subtitle={`Kontributor omset utama pada ${periodInfo.currentLabel || 'periode terpilih'}`}
                        rows={data?.topCustomers || []}
                        loading={loading}
                        periodInfo={periodInfo}
                        lowestMode={lowestMode}
                        setLowestMode={setLowestMode}
                        getCustomerDetailUrl={getCustomerDetailUrl}
                    />

                    <LeaderboardBentoCard
                        variant="lowest"
                        title={
                            lowestMode === 'drop'
                                ? 'Top 5 Penurunan Penjualan Terbesar'
                                : 'Top 5 Penjualan Terendah'
                        }
                        subtitle={
                            lowestMode === 'drop'
                                ? `Penurunan omset terbesar dibanding ${periodInfo.previousLabel || 'periode lalu'}`
                                : 'Customer bertransaksi dengan nilai omset terkecil (> Rp 0)'
                        }
                        rows={lowestListData}
                        loading={loading}
                        periodInfo={periodInfo}
                        lowestMode={lowestMode}
                        setLowestMode={setLowestMode}
                        getCustomerDetailUrl={getCustomerDetailUrl}
                    />
                </section>

                {/* ════════════════════════════════════════════════════════════════
                    6. FULL CUSTOMER PERFORMANCE EXPLORER (TABLE + MOBILE CARDS)
                ════════════════════════════════════════════════════════════════ */}
                <motion.section
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden rounded-3xl border border-sidebar-border/80 bg-card shadow-xs"
                >
                    {/* Explorer Toolbar */}
                    <div className="space-y-4 border-b border-sidebar-border/70 bg-muted/25 p-4 sm:p-6">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                                        Peringkat &amp; Analisis Seluruh Customer
                                    </h2>
                                    <span className="rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-xs font-bold text-emerald-700 tabular-nums dark:text-emerald-300">
                                        {formatNumber(totalRows)} /{' '}
                                        {formatNumber((data?.allCustomers || []).length)} Akun
                                    </span>
                                </div>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    Klik nama customer untuk membuka dasbor detail faktur, tren material DO, dan profil AI akun tersebut
                                </p>
                            </div>

                            {/* Search + Cluster Filter */}
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <div className="relative w-full sm:w-64">
                                    <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        type="text"
                                        value={searchCustomer}
                                        onChange={(e) => {
                                            setSearchCustomer(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        placeholder="Cari nama atau kode customer..."
                                        className="h-9 rounded-xl pr-8 pl-9 text-xs sm:text-sm"
                                    />
                                    <AnimatePresence>
                                        {searchCustomer && (
                                            <motion.button
                                                type="button"
                                                initial={{ opacity: 0, scale: 0.7 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.7 }}
                                                transition={{ duration: 0.15 }}
                                                onClick={() => {
                                                    setSearchCustomer('');
                                                    setCurrentPage(1);
                                                }}
                                                aria-label="Hapus pencarian"
                                                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </motion.button>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {availableClusters.length > 0 && (
                                    <select
                                        aria-label="Filter Segmen K-Means"
                                        value={clusterFilter}
                                        onChange={(e) => {
                                            setClusterFilter(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="h-9 rounded-xl border border-sidebar-border bg-background px-3 text-xs font-semibold text-foreground outline-none transition-colors focus:border-emerald-500"
                                    >
                                        <option value="all">Semua Segmen ML</option>
                                        {availableClusters.map((cl) => (
                                            <option key={cl.name} value={cl.name}>
                                                {cl.name} ({cl.count})
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>

                        {/* Status Filter Pill Bar (Animated Spring Slider) */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            {statusFilterTabs.map((tab) => {
                                const active = statusFilter === tab.value;
                                return (
                                    <button
                                        key={tab.value}
                                        type="button"
                                        onClick={() => {
                                            setStatusFilter(tab.value);
                                            setCurrentPage(1);
                                        }}
                                        className={`relative rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                            active
                                                ? 'border-transparent text-slate-950'
                                                : 'border-sidebar-border bg-background/80 text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                                        }`}
                                    >
                                        {active && (
                                            <motion.span
                                                layoutId="statusFilterPill"
                                                transition={{
                                                    type: 'spring',
                                                    stiffness: 430,
                                                    damping: 34,
                                                }}
                                                className="absolute inset-0 rounded-xl bg-emerald-500 shadow-xs"
                                            />
                                        )}
                                        <span className="relative z-10">{tab.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Desktop / Tablet Data Table (>= md) */}
                    <div className="hidden overflow-x-auto md:block">
                        <table className="w-full border-collapse text-left text-xs">
                            <thead>
                                <tr className="border-b border-sidebar-border/80 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                    <th className="px-4 py-3">
                                        <button
                                            type="button"
                                            onClick={() => handleSort('rank')}
                                            className="inline-flex items-center gap-1 hover:text-foreground"
                                        >
                                            <span>Rank</span>
                                            {renderSortIcon('rank')}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3">
                                        <button
                                            type="button"
                                            onClick={() => handleSort('nm_cs')}
                                            className="inline-flex items-center gap-1 hover:text-foreground"
                                        >
                                            <span>Customer &amp; Segmen ML</span>
                                            {renderSortIcon('nm_cs')}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-right">
                                        <button
                                            type="button"
                                            onClick={() => handleSort('curr_sales')}
                                            className="inline-flex items-center justify-end gap-1 hover:text-foreground"
                                        >
                                            <span>Periode Berjalan</span>
                                            {renderSortIcon('curr_sales')}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-right">
                                        <button
                                            type="button"
                                            onClick={() => handleSort('prev_sales')}
                                            className="inline-flex items-center justify-end gap-1 hover:text-foreground"
                                        >
                                            <span>Periode Lalu</span>
                                            {renderSortIcon('prev_sales')}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-right">
                                        <button
                                            type="button"
                                            onClick={() => handleSort('growth')}
                                            className="inline-flex items-center justify-end gap-1 hover:text-foreground"
                                        >
                                            <span>Growth</span>
                                            {renderSortIcon('growth')}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-right">
                                        <button
                                            type="button"
                                            onClick={() => handleSort('curr_invoices')}
                                            className="inline-flex items-center justify-end gap-1 hover:text-foreground"
                                        >
                                            <span>Faktur</span>
                                            {renderSortIcon('curr_invoices')}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3">
                                        <button
                                            type="button"
                                            onClick={() => handleSort('status')}
                                            className="inline-flex items-center gap-1 hover:text-foreground"
                                        >
                                            <span>Status &amp; Rekomendasi Aksi AI</span>
                                            {renderSortIcon('status')}
                                        </button>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-sidebar-border/50">
                                {loading && paginatedCustomers.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center">
                                            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                                                <RefreshCw className="h-4 w-4 animate-spin text-emerald-500" />
                                                <span>Memuat tabel performa seluruh customer...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : paginatedCustomers.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="px-4 py-12 text-center text-sm text-muted-foreground"
                                        >
                                            Tidak ada customer yang sesuai dengan pencarian atau filter aktif.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedCustomers.map((c, idx) => {
                                        const statusLabel = c.ai_status || c.status || 'Reguler';
                                        const statusTone = getToneStyle(c.ai_badge, statusLabel);
                                        const clusterTone = getToneStyle(
                                            c.ml_cluster_badge,
                                            c.ml_cluster,
                                        );
                                        const growthVal = Number(c.growth || 0);
                                        const churnPct = Math.round(Number(c.churn_prob || 0) * 100);
                                        const churnTone = getToneStyle(c.churn_badge, c.churn_risk_level);

                                        return (
                                            <motion.tr
                                                key={`${safeCurrentPage}-${c.kd_cs}`}
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{
                                                    duration: 0.24,
                                                    delay: Math.min(idx * 0.025, 0.22),
                                                    ease: [0.16, 1, 0.3, 1],
                                                }}
                                                className="transition-colors hover:bg-muted/30"
                                            >
                                                <td className="px-4 py-3.5 align-top">
                                                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-muted font-extrabold text-foreground tabular-nums">
                                                        {c.rank}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-3.5 align-top">
                                                    <Link
                                                        href={getCustomerDetailUrl(c.kd_cs)}
                                                        className="font-bold text-foreground transition-colors hover:text-emerald-600 dark:hover:text-emerald-400"
                                                    >
                                                        {c.nm_cs}
                                                    </Link>
                                                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                        <span className="font-mono text-[10.5px] text-muted-foreground">
                                                            {c.kd_cs}
                                                        </span>
                                                        {c.ml_cluster && (
                                                            <span
                                                                className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${clusterTone.pill}`}
                                                            >
                                                                {c.ml_cluster}
                                                            </span>
                                                        )}
                                                        {c.churn_risk_level &&
                                                            c.churn_risk_level !== 'Non-Aktif' && (
                                                                <span
                                                                    className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${churnTone.pill}`}
                                                                >
                                                                    Churn {churnPct}%
                                                                </span>
                                                            )}
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3.5 text-right align-top font-bold text-foreground tabular-nums">
                                                    {formatRupiah(c.curr_sales)}
                                                </td>

                                                <td className="px-4 py-3.5 text-right align-top text-muted-foreground tabular-nums">
                                                    {formatRupiah(c.prev_sales)}
                                                </td>

                                                <td className="px-4 py-3.5 text-right align-top">
                                                    <span
                                                        className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-bold tabular-nums ${
                                                            growthVal > 0
                                                                ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                                                                : growthVal < 0
                                                                  ? 'bg-rose-500/12 text-rose-600 dark:text-rose-400'
                                                                  : 'bg-muted text-muted-foreground'
                                                        }`}
                                                    >
                                                        {growthVal > 0 ? (
                                                            <ArrowUpRight className="h-3 w-3" />
                                                        ) : growthVal < 0 ? (
                                                            <ArrowDownRight className="h-3 w-3" />
                                                        ) : (
                                                            <Minus className="h-3 w-3" />
                                                        )}
                                                        {formatPercent(growthVal)}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-3.5 text-right align-top font-semibold text-foreground tabular-nums">
                                                    {formatNumber(c.curr_invoices)}
                                                </td>

                                                <td className="max-w-xs px-4 py-3.5 align-top">
                                                    <span
                                                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusTone.pill}`}
                                                    >
                                                        <span
                                                            className={`h-1.5 w-1.5 rounded-full ${statusTone.dot}`}
                                                        />
                                                        {statusLabel}
                                                    </span>
                                                    {c.ai_action && (
                                                        <p className="mt-1.5 text-[11px] font-medium leading-snug text-foreground/85">
                                                            {c.ai_action}
                                                        </p>
                                                    )}
                                                    {c.ai_reason && (
                                                        <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">
                                                            {c.ai_reason}
                                                        </p>
                                                    )}
                                                </td>
                                            </motion.tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Customer Card Stack (< md) */}
                    <div className="divide-y divide-sidebar-border/60 md:hidden">
                        {loading && paginatedCustomers.length === 0 ? (
                            <div className="space-y-3 p-4">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/60" />
                                ))}
                            </div>
                        ) : paginatedCustomers.length === 0 ? (
                            <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                                Tidak ada customer yang sesuai dengan filter aktif.
                            </div>
                        ) : (
                            paginatedCustomers.map((c, idx) => {
                                const statusLabel = c.ai_status || c.status || 'Reguler';
                                const statusTone = getToneStyle(c.ai_badge, statusLabel);
                                const clusterTone = getToneStyle(c.ml_cluster_badge, c.ml_cluster);
                                const growthVal = Number(c.growth || 0);

                                return (
                                    <motion.div
                                        key={`mob-${safeCurrentPage}-${c.kd_cs}`}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{
                                            duration: 0.25,
                                            delay: Math.min(idx * 0.03, 0.24),
                                            ease: [0.16, 1, 0.3, 1],
                                        }}
                                        className="space-y-2.5 p-4"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex min-w-0 items-start gap-2.5">
                                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-extrabold text-foreground tabular-nums">
                                                    #{c.rank}
                                                </span>
                                                <div className="min-w-0">
                                                    <Link
                                                        href={getCustomerDetailUrl(c.kd_cs)}
                                                        className="line-clamp-1 text-sm font-bold text-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
                                                    >
                                                        {c.nm_cs}
                                                    </Link>
                                                    <span className="font-mono text-[10px] text-muted-foreground">
                                                        {c.kd_cs} &bull; {formatNumber(c.curr_invoices)} faktur
                                                    </span>
                                                </div>
                                            </div>
                                            <span
                                                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                                                    growthVal > 0
                                                        ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                                                        : growthVal < 0
                                                          ? 'bg-rose-500/12 text-rose-600 dark:text-rose-400'
                                                          : 'bg-muted text-muted-foreground'
                                                }`}
                                            >
                                                {formatPercent(growthVal)}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/35 p-2.5 text-xs">
                                            <div>
                                                <span className="block text-[10px] text-muted-foreground">
                                                    Berjalan
                                                </span>
                                                <span className="font-extrabold text-foreground tabular-nums">
                                                    {formatRupiah(c.curr_sales)}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="block text-[10px] text-muted-foreground">
                                                    Periode Lalu
                                                </span>
                                                <span className="font-semibold text-muted-foreground tabular-nums">
                                                    {formatRupiah(c.prev_sales)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span
                                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${statusTone.pill}`}
                                            >
                                                {statusLabel}
                                            </span>
                                            {c.ml_cluster && (
                                                <span
                                                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${clusterTone.pill}`}
                                                >
                                                    {c.ml_cluster}
                                                </span>
                                            )}
                                        </div>

                                        {c.ai_action && (
                                            <p className="text-[11px] font-medium text-muted-foreground">
                                                {c.ai_action}
                                            </p>
                                        )}
                                    </motion.div>
                                );
                            })
                        )}
                    </div>

                    {/* Pagination Bar */}
                    <div className="flex flex-col gap-3 border-t border-sidebar-border/70 bg-muted/20 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>Tampilkan:</span>
                            <select
                                aria-label="Jumlah baris per halaman"
                                value={perPage}
                                onChange={(e) => {
                                    const val =
                                        e.target.value === 'all' ? 'all' : Number(e.target.value);
                                    setPerPage(val);
                                    setCurrentPage(1);
                                }}
                                className="h-8 rounded-lg border border-sidebar-border bg-background px-2 text-xs font-semibold text-foreground outline-none"
                            >
                                {[5, 10, 15, 25, 50].map((n) => (
                                    <option key={n} value={n}>
                                        {n} baris
                                    </option>
                                ))}
                                <option value="all">Semua</option>
                            </select>
                            <span className="tabular-nums">
                                Halaman {safeCurrentPage} dari {totalPages} ({formatNumber(totalRows)} data)
                            </span>
                        </div>

                        {perPage !== 'all' && totalPages > 1 && (
                            <div className="flex flex-wrap items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setCurrentPage((p) => Math.max(1, p - 1))
                                    }
                                    disabled={safeCurrentPage <= 1}
                                    aria-label="Halaman sebelumnya"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sidebar-border bg-background text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-40"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>

                                {paginationPages.map((pg, idx) =>
                                    pg === '...' ? (
                                        <span
                                            key={`dots-${idx}`}
                                            className="px-1.5 text-xs text-muted-foreground"
                                        >
                                            ...
                                        </span>
                                    ) : (
                                        <button
                                            key={`pg-${pg}`}
                                            type="button"
                                            onClick={() => setCurrentPage(pg)}
                                            className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-bold tabular-nums transition-colors ${
                                                safeCurrentPage === pg
                                                    ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                                                    : 'border-sidebar-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                                            }`}
                                        >
                                            {pg}
                                        </button>
                                    ),
                                )}

                                <button
                                    type="button"
                                    onClick={() =>
                                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                                    }
                                    disabled={safeCurrentPage >= totalPages}
                                    aria-label="Halaman berikutnya"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sidebar-border bg-background text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-40"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </motion.section>
            </div>
        </AppLayout>
    );
}
