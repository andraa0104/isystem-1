import { useAppearance } from '@/hooks/use-appearance';
import { store } from '@/routes/login-store';
import { Head, useForm, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowRight,
    Building2,
    Check,
    ChevronDown,
    Cpu,
    Database,
    Eye,
    EyeOff,
    KeyRound,
    Layers,
    Megaphone,
    Moon,
    Package,
    ShieldCheck,
    Sparkles,
    Sun,
    TrendingUp,
    UserRound,
    Wallet,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import '../../../css/login.css';

const databaseLabels = {
    dbsja: 'DB SJA',
    dbbbbs: 'DB B3S',
    dbstg: 'DB STG',
    dbati: 'DB ATI',
    dbarm: 'DB ARM',
    dbjms: 'DB JMS',
};

const databaseCompanies = {
    dbsja: 'CV. Semesta Jaya Abadi',
    dbbbbs: 'CV. Berkah Tiga Bersaudara',
    dbstg: 'CV. Surya Teknik Gemilang',
    dbati: 'CV. Anugerah Teknik Indonesia',
    dbarm: 'CV. Armada Raya Mandiri',
    dbjms: 'CV. JLX Makmur Sentosa',
};

/* ─── Animated Spiritual Quote Card (Gemini Loading Glow Effect) ─────────── */
function SpiritualQuoteCard({ mobile = false }) {
    return (
        <div className={mobile ? 'fs-quote-mobile-wrapper' : 'fs-quote-wrapper'}>
            <motion.div
                className={mobile ? 'fs-quote-card-mobile' : 'fs-quote-card'}
                initial={{ opacity: 0, y: 28, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                    duration: 0.7,
                    delay: mobile ? 0.3 : 0.65,
                    ease: [0.16, 1, 0.3, 1],
                }}
            >
                <div className="fs-quote-eyebrow">
                    <div className="fs-gemini-spinner" aria-hidden="true">
                        <div className="fs-gemini-spinner-ring" />
                        <Sparkles size={13} className="fs-gemini-sparkle" />
                    </div>
                    <span>Niat Baik Bekerja</span>
                </div>
                <p className="fs-quote-title">
                    Sebelum bekerja, <span>ucapkan bismillah.</span>
                </p>
                <p className="fs-quote-desc">
                    Niatkan bekerja sebagai ibadah, urusan rezeki akan mengikuti
                    dan mengalir dengan sendirinya.
                </p>
            </motion.div>
        </div>
    );
}

/* ─── Freely Drifting Background Ornaments (Bergerak Bebas & Animatif) ─────── */
function FloatingBackgroundOrnaments() {
    return (
        <div className="fs-floating-ornaments-layer" aria-hidden="true">
            {/* 1. Hologram Hexagon Node (Drifting top-left to center-left) */}
            <motion.div
                className="fs-ornament fs-ornament-hex"
                style={{ top: '10%', left: '8%' }}
                animate={{
                    x: [0, 80, -35, 65, -20, 0],
                    y: [0, -45, 55, -30, 40, 0],
                    rotate: [0, 90, 180, 270, 360],
                    scale: [1, 1.12, 0.92, 1.08, 1],
                }}
                transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
            >
                <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                    <polygon
                        points="22,3 39,13 39,31 22,41 5,31 5,13"
                        stroke="#10b981"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                        opacity="0.65"
                    />
                    <circle cx="22" cy="22" r="3.5" fill="#34d399" opacity="0.8" />
                </svg>
            </motion.div>

            {/* 2. Floating Tech Crosshair / Plus (Cyan HUD Precision) */}
            <motion.div
                className="fs-ornament fs-ornament-plus"
                style={{ top: '62%', left: '10%' }}
                animate={{
                    x: [0, 55, -45, 75, -25, 0],
                    y: [0, -65, 45, -50, 60, 0],
                    rotate: [0, 180, 360],
                    scale: [0.9, 1.15, 0.85, 1.1, 0.9],
                }}
                transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut' }}
            >
                <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
                    <line x1="15" y1="4" x2="15" y2="26" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
                    <line x1="4" y1="15" x2="26" y2="15" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
                    <circle cx="15" cy="15" r="7" stroke="#06b6d4" strokeWidth="1" strokeDasharray="2 2" opacity="0.45" />
                </svg>
            </motion.div>

            {/* 3. Floating ERP Live Pill Badge */}
            <motion.div
                className="fs-ornament fs-ornament-badge"
                style={{ top: '18%', right: '12%' }}
                animate={{
                    x: [0, -70, 45, -85, 25, 0],
                    y: [0, 65, -45, 55, -30, 0],
                    rotate: [-3, 5, -4, 3, -3],
                }}
                transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
            >
                <span className="fs-ornament-dot" />
                <span>ERP::CORE</span>
            </motion.div>

            {/* 4. Floating 4-Point Sparkling Star */}
            <motion.div
                className="fs-ornament fs-ornament-sparkle"
                style={{ top: '35%', left: '18%' }}
                animate={{
                    x: [0, 65, -55, 70, -35, 0],
                    y: [0, 75, -45, 50, -55, 0],
                    rotate: [0, 180, 360],
                    scale: [0.8, 1.3, 0.75, 1.2, 0.8],
                }}
                transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
            >
                <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                    <path
                        d="M17 2 L20 13 L31 17 L20 21 L17 32 L14 21 L3 17 L14 13 Z"
                        fill="#34d399"
                        opacity="0.75"
                    />
                </svg>
            </motion.div>

            {/* 5. Floating Rhombus / Diamond Cube (Indigo) */}
            <motion.div
                className="fs-ornament fs-ornament-cube"
                style={{ top: '44%', right: '9%' }}
                animate={{
                    x: [0, -80, 40, -65, 35, 0],
                    y: [0, -60, 70, -40, 50, 0],
                    rotate: [0, -90, -180, -270, -360],
                    scale: [0.9, 1.1, 0.95, 1.15, 0.9],
                }}
                transition={{ duration: 27, repeat: Infinity, ease: 'easeInOut' }}
            >
                <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
                    <rect
                        x="7"
                        y="7"
                        width="24"
                        height="24"
                        rx="5"
                        transform="rotate(45 19 19)"
                        stroke="#818cf8"
                        strokeWidth="1.5"
                        opacity="0.6"
                    />
                    <circle cx="19" cy="19" r="4" fill="#818cf8" opacity="0.5" />
                </svg>
            </motion.div>

            {/* 6. Floating Code Pill `<system />` */}
            <motion.div
                className="fs-ornament fs-ornament-code"
                style={{ bottom: '26%', right: '14%' }}
                animate={{
                    x: [0, -65, 35, -50, 55, 0],
                    y: [0, -65, 55, -30, 45, 0],
                    rotate: [0, 12, -12, 8, 0],
                    scale: [0.95, 1.08, 0.9, 1.05, 0.95],
                }}
                transition={{ duration: 23, repeat: Infinity, ease: 'easeInOut' }}
            >
                <code>&lt;system /&gt;</code>
            </motion.div>

            {/* 7. Floating Data Stream Radar Ring */}
            <motion.div
                className="fs-ornament fs-ornament-radar"
                style={{ bottom: '16%', left: '32%' }}
                animate={{
                    x: [0, -55, 65, -35, 45, 0],
                    y: [0, -75, 45, -55, 45, 0],
                    scale: [1, 1.25, 0.9, 1.18, 1],
                }}
                transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
            >
                <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
                    <circle cx="19" cy="19" r="15" stroke="#10b981" strokeWidth="1" strokeDasharray="3 3" opacity="0.45" />
                    <circle cx="19" cy="19" r="8" stroke="#34d399" strokeWidth="1" opacity="0.65" />
                    <circle cx="19" cy="19" r="2.5" fill="#34d399" />
                </svg>
            </motion.div>

            {/* 8. Floating Micro Constellation Triad */}
            <motion.div
                className="fs-ornament fs-ornament-triad"
                style={{ bottom: '40%', left: '7%' }}
                animate={{
                    x: [0, 65, -35, 75, -40, 0],
                    y: [0, -70, 50, -40, 60, 0],
                    rotate: [0, 120, 240, 360],
                }}
                transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
            >
                <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
                    <line x1="10" y1="32" x2="21" y2="10" stroke="#fb7185" strokeWidth="1" opacity="0.5" />
                    <line x1="21" y1="10" x2="33" y2="30" stroke="#fb7185" strokeWidth="1" opacity="0.5" />
                    <line x1="33" y1="30" x2="10" y2="32" stroke="#fb7185" strokeWidth="1" strokeDasharray="3 3" opacity="0.35" />
                    <circle cx="10" cy="32" r="3" fill="#fb7185" opacity="0.8" />
                    <circle cx="21" cy="10" r="3" fill="#fb7185" opacity="0.8" />
                    <circle cx="33" cy="30" r="3" fill="#fb7185" opacity="0.8" />
                </svg>
            </motion.div>
        </div>
    );
}

/* ─── 4 Pillars Dynamic Cosmos Hub (Penjualan, Persediaan, Keuangan, Marketing) ─── */
function CosmosHubVisual() {
    return (
        <div className="fs-hub-wrapper" aria-hidden="true">
            <div className="fs-cosmos-stage">
                {/* Connecting SVG Energy Flow Lines dengan Animasi Tampil Drawing */}
                <motion.svg
                    className="fs-energy-lines"
                    viewBox="0 0 500 400"
                    fill="none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 0.5 }}
                >
                    <motion.path
                        d="M250 200 L90 80"
                        stroke="#10b981"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                        opacity="0.45"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.8, delay: 0.5 }}
                    />
                    <motion.path
                        d="M250 200 L80 320"
                        stroke="#06b6d4"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                        opacity="0.45"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.8, delay: 0.6 }}
                    />
                    <motion.path
                        d="M250 200 L410 90"
                        stroke="#818cf8"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                        opacity="0.45"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.8, delay: 0.7 }}
                    />
                    <motion.path
                        d="M250 200 L420 310"
                        stroke="#fb7185"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                        opacity="0.45"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.8, delay: 0.8 }}
                    />
                </motion.svg>

                {/* Rotating Dashed Orbit Rings dengan Efek Mengembang saat Dibuka */}
                <motion.div
                    className="fs-orbit-circle fs-orbit-3"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1, rotate: 360 }}
                    transition={{
                        scale: { duration: 1.2, delay: 0.1, ease: [0.16, 1, 0.3, 1] },
                        opacity: { duration: 0.8, delay: 0.1 },
                        rotate: { duration: 50, repeat: Infinity, ease: 'linear' },
                    }}
                />
                <motion.div
                    className="fs-orbit-circle fs-orbit-2"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1, rotate: -360 }}
                    transition={{
                        scale: { duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] },
                        opacity: { duration: 0.7, delay: 0.2 },
                        rotate: { duration: 32, repeat: Infinity, ease: 'linear' },
                    }}
                />
                <motion.div
                    className="fs-orbit-circle fs-orbit-1"
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1, rotate: 360 }}
                    transition={{
                        scale: { duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] },
                        opacity: { duration: 0.6, delay: 0.3 },
                        rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
                    }}
                />

                {/* Central i-System Chip with Entrance Zoom & Glow */}
                <motion.div
                    className="fs-core-chip"
                    initial={{ scale: 0.5, opacity: 0, y: 15 }}
                    animate={{
                        scale: [1, 1.03, 1],
                        opacity: 1,
                        y: 0,
                        boxShadow: [
                            '0 0 35px rgba(16, 185, 129, 0.3)',
                            '0 0 55px rgba(16, 185, 129, 0.55)',
                            '0 0 35px rgba(16, 185, 129, 0.3)',
                        ],
                    }}
                    transition={{
                        scale: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
                        opacity: { duration: 0.6, delay: 0.25 },
                        y: { duration: 0.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] },
                        boxShadow: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
                    }}
                >
                    <div className="fs-core-icon">
                        <Cpu size={26} />
                    </div>
                    <span className="fs-core-name">i-System</span>
                    <span className="fs-core-desc">Enterprise Resource Planning</span>
                </motion.div>

                {/* Satellite Node 1: Penjualan (Meluncur keluar dari kiri atas) */}
                <motion.div
                    className="fs-satellite-node fs-node-sales"
                    initial={{ opacity: 0, x: -35, y: -25, scale: 0.8 }}
                    animate={{ opacity: 1, x: 0, y: [-5, 5, -5], scale: 1 }}
                    transition={{
                        opacity: { duration: 0.6, delay: 0.45 },
                        scale: { duration: 0.6, delay: 0.45 },
                        x: { duration: 0.6, delay: 0.45, ease: [0.16, 1, 0.3, 1] },
                        y: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' },
                    }}
                >
                    <div className="fs-node-icon">
                        <TrendingUp size={16} />
                    </div>
                    <div className="fs-node-text">
                        <strong>Penjualan</strong>
                        <small>Sales Order</small>
                    </div>
                </motion.div>

                {/* Satellite Node 2: Persediaan (Meluncur keluar dari kiri bawah) */}
                <motion.div
                    className="fs-satellite-node fs-node-inventory"
                    initial={{ opacity: 0, x: -35, y: 25, scale: 0.8 }}
                    animate={{ opacity: 1, x: 0, y: [5, -5, 5], scale: 1 }}
                    transition={{
                        opacity: { duration: 0.6, delay: 0.55 },
                        scale: { duration: 0.6, delay: 0.55 },
                        x: { duration: 0.6, delay: 0.55, ease: [0.16, 1, 0.3, 1] },
                        y: { duration: 4.8, repeat: Infinity, ease: 'easeInOut', delay: 0.8 },
                    }}
                >
                    <div className="fs-node-icon">
                        <Package size={16} />
                    </div>
                    <div className="fs-node-text">
                        <strong>Persediaan</strong>
                        <small>Stock Control</small>
                    </div>
                </motion.div>

                {/* Satellite Node 3: Keuangan (Meluncur keluar dari kanan atas) */}
                <motion.div
                    className="fs-satellite-node fs-node-finance"
                    initial={{ opacity: 0, x: 35, y: -25, scale: 0.8 }}
                    animate={{ opacity: 1, x: 0, y: [-4, 6, -4], scale: 1 }}
                    transition={{
                        opacity: { duration: 0.6, delay: 0.65 },
                        scale: { duration: 0.6, delay: 0.65 },
                        x: { duration: 0.6, delay: 0.65, ease: [0.16, 1, 0.3, 1] },
                        y: { duration: 5.2, repeat: Infinity, ease: 'easeInOut', delay: 1.2 },
                    }}
                >
                    <div className="fs-node-icon">
                        <Wallet size={16} />
                    </div>
                    <div className="fs-node-text">
                        <strong>Keuangan</strong>
                        <small>Accounting</small>
                    </div>
                </motion.div>

                {/* Satellite Node 4: Marketing (Meluncur keluar dari kanan bawah) */}
                <motion.div
                    className="fs-satellite-node fs-node-marketing"
                    initial={{ opacity: 0, x: 35, y: 25, scale: 0.8 }}
                    animate={{ opacity: 1, x: 0, y: [6, -4, 6], scale: 1 }}
                    transition={{
                        opacity: { duration: 0.6, delay: 0.75 },
                        scale: { duration: 0.6, delay: 0.75 },
                        x: { duration: 0.6, delay: 0.75, ease: [0.16, 1, 0.3, 1] },
                        y: { duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 1.8 },
                    }}
                >
                    <div className="fs-node-icon">
                        <Megaphone size={16} />
                    </div>
                    <div className="fs-node-text">
                        <strong>Marketing</strong>
                        <small>Campaign & CRM</small>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

/* ─── Main Login Page (Full Screen Immersive with Coordinated Entrance) ─── */
export default function Login({ status, databases = [], selectedDatabase }) {
    const page = usePage();
    const { appearance, updateAppearance } = useAppearance();

    const defaultDatabase = databases.includes(selectedDatabase)
        ? selectedDatabase
        : '';

    const { data, setData, post, processing, errors, reset } = useForm({
        ...store.form(),
        database: defaultDatabase,
    });

    const [showPassword, setShowPassword] = useState(false);
    const [capsLock, setCapsLock] = useState(false);

    // Custom Animated Dropdown State
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Track focused fields for animated floating labels
    const [focusedField, setFocusedField] = useState(null);

    // Authentication States: Sukses, Loading & Error Shake
    const [isSuccess, setIsSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isErrorShake, setIsErrorShake] = useState(false);
    const [customErrors, setCustomErrors] = useState({});

    const pageErrors = page.props?.errors ?? {};
    const databaseError = customErrors.database || errors.database || pageErrors.database;
    const usernameError = customErrors.pengguna || errors.pengguna || pageErrors.pengguna;
    const passwordError = customErrors.password || errors.password || pageErrors.password;
    const flashError = customErrors.general || page.props?.flash?.error;

    const hasAuthError = Boolean(usernameError || passwordError || flashError);

    // Helper untuk ambil CSRF token dari meta tag atau cookie
    const getCsrfToken = () => {
        if (typeof document !== 'undefined') {
            const meta = document.querySelector('meta[name="csrf-token"]');
            if (meta && meta.content) return meta.content;
            const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
            if (match) return decodeURIComponent(match[1]);
        }
        return '';
    };

    // Close dropdown saat user klik di luar area dropdown
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        }
        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isDropdownOpen]);

    const triggerErrorShake = () => {
        setIsErrorShake(true);
        setTimeout(() => setIsErrorShake(false), 750);
    };

    // Otomatis getarkan field username & password saat ada error autentikasi
    useEffect(() => {
        if (hasAuthError) {
            triggerErrorShake();
        }
    }, [hasAuthError, usernameError, passwordError, flashError]);

    const submit = async (event) => {
        event.preventDefault();
        if (isSubmitting || processing || isSuccess) return;

        if (!data.database) {
            setCustomErrors({ database: 'Silakan pilih database perusahaan terlebih dahulu.' });
            setIsDropdownOpen(true);
            return;
        }

        setIsSubmitting(true);
        setCustomErrors({});

        try {
            const csrfToken = getCsrfToken();
            const response = await fetch('/login-simple', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, text/html',
                    'X-Inertia': 'true',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    database: data.database,
                    pengguna: data.pengguna,
                    password: data.password,
                }),
            });

            // Status 409 atau header X-Inertia-Location menandakan autentikasi berhasil
            const inertiaLocation = response.headers.get('x-inertia-location');
            if (response.status === 409 || inertiaLocation || response.ok) {
                setIsSuccess(true);
                setIsSubmitting(false);

                // Beri jeda 1 detik agar animasi sukses tampil memuaskan sebelum diarahkan ke dashboard
                const targetUrl = inertiaLocation || '/dashboard';
                setTimeout(() => {
                    window.location.href = targetUrl;
                }, 1000);
                return;
            }

            // Validasi gagal (misal username/password salah)
            if (response.status === 422) {
                const errData = await response.json().catch(() => ({}));
                setCustomErrors(errData.errors || { pengguna: 'Username atau password salah.' });
                triggerErrorShake();
                setIsSubmitting(false);
                setData('password', '');
                return;
            }

            const errData = await response.json().catch(() => ({}));
            setCustomErrors(errData.errors || { general: errData.message || 'Terjadi kesalahan saat autentikasi.' });
            triggerErrorShake();
            setIsSubmitting(false);
        } catch {
            // Fallback ke post Inertia jika terjadi kendala network
            post('/login-simple', {
                onSuccess: () => {
                    setIsSuccess(true);
                    setTimeout(() => {
                        window.location.href = '/dashboard';
                    }, 1000);
                },
                onError: () => {
                    triggerErrorShake();
                    setIsSubmitting(false);
                },
                onFinish: () => {
                    reset('password');
                    setShowPassword(false);
                    setCapsLock(false);
                    setIsSubmitting(false);
                },
            });
        }
    };

    const toggleTheme = () => {
        const next = appearance === 'dark' ? 'light' : 'dark';
        updateAppearance(next);
    };

    return (
        <>
            <Head title="Masuk - i-System" />
            <motion.div
                className="fs-login-root"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
            >
                <div className="fs-stage">
                    {/* ── Sisi Kiri: Full Visual Cosmos (Enterprise Hub & 4 Pillars) ── */}
                    <motion.section
                        className="fs-visual-side"
                        aria-label="Ekosistem Terintegrasi i-System"
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <div className="fs-cyber-canvas" aria-hidden="true">
                            <div className="fs-cyber-grid" />
                            <motion.div
                                className="fs-light-nebula fs-nebula-emerald"
                                animate={{
                                    x: [0, 30, -25, 0],
                                    y: [0, -25, 25, 0],
                                    scale: [1, 1.1, 0.95, 1],
                                }}
                                transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
                            />
                            <motion.div
                                className="fs-light-nebula fs-nebula-blue"
                                animate={{
                                    x: [0, -35, 30, 0],
                                    y: [0, 30, -20, 0],
                                    scale: [1, 1.08, 0.92, 1],
                                }}
                                transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
                            />
                            <motion.div
                                className="fs-light-nebula fs-nebula-violet"
                                animate={{
                                    x: [0, 25, -30, 0],
                                    y: [0, -20, 30, 0],
                                    scale: [1, 1.12, 0.9, 1],
                                }}
                                transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
                            />
                        </div>

                        {/* Ornamen Background Bergerak Bebas (Floating Tech HUD Elements) */}
                        <FloatingBackgroundOrnaments />

                        {/* Visual Cosmos Hub (Core Chip + 4 Modules: Penjualan, Persediaan, Keuangan, Marketing) */}
                        <CosmosHubVisual />

                        {/* Spiritual Quote Card (Bismillah & Berkah - Tetap Dipertahankan) */}
                        <SpiritualQuoteCard />
                    </motion.section>

                    {/* ── Sisi Kanan: Form Masuk Full Screen dengan Entrance Animasi Bertahap ── */}
                    <motion.section
                        className="fs-form-side"
                        aria-labelledby="form-heading"
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    >
                        {/* Topbar: Tombol Toggle Tema Meluncur Turun */}
                        <motion.div
                            className="fs-right-topbar"
                            initial={{ opacity: 0, y: -15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <motion.button
                                type="button"
                                className="fs-theme-btn"
                                onClick={toggleTheme}
                                title={`Ganti ke mode ${appearance === 'dark' ? 'terang' : 'gelap'}`}
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.96 }}
                            >
                                {appearance === 'dark' ? (
                                    <>
                                        <Sun size={14} aria-hidden="true" />
                                        <span>Mode Terang</span>
                                    </>
                                ) : (
                                    <>
                                        <Moon size={14} aria-hidden="true" />
                                        <span>Mode Gelap</span>
                                    </>
                                )}
                            </motion.button>
                        </motion.div>

                        {/* Form Body Core */}
                        <div className="fs-form-core">
                            {/* Heading Meluncur Turun Halus */}
                            <motion.div
                                className="fs-form-head"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            >
                                <div className="fs-badge-tag">
                                    <Layers size={11} aria-hidden="true" />
                                    <span>Portal Akses ERP</span>
                                </div>
                                <h1 id="form-heading" className="fs-title">
                                    Selamat Datang.
                                </h1>
                                <p className="fs-subtitle">
                                    Silakan pilih perusahaan dan masukkan akun Anda untuk melanjutkan.
                                </p>
                            </motion.div>

                            {/* Flash Error Alert */}
                            <AnimatePresence>
                                {flashError && (
                                    <motion.div
                                        className="fs-alert fs-alert-error"
                                        role="alert"
                                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                    >
                                        <AlertCircle size={15} />
                                        <span>{flashError}</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Status Success Alert */}
                            <AnimatePresence>
                                {status && (
                                    <motion.div
                                        className="fs-alert fs-alert-success"
                                        role="status"
                                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                    >
                                        <Sparkles size={15} />
                                        <span>{status}</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Form Input dengan Entrance Stagger & Floating Morphing Labels */}
                            <form onSubmit={submit} className="fs-form-body" aria-busy={processing}>
                                {/* 1. Dropdown Perusahaan / Database (Kustom & Beranimasi Modern) */}
                                <motion.div
                                    ref={dropdownRef}
                                    className={`fs-field-group fs-dropdown-group ${
                                        focusedField === 'database' || isDropdownOpen || Boolean(data.database)
                                            ? 'is-active'
                                            : ''
                                    } ${isDropdownOpen ? 'is-open' : ''} ${databaseError ? 'has-error' : ''}`}
                                    initial={{ opacity: 0, y: 18 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') {
                                            setIsDropdownOpen(false);
                                        }
                                    }}
                                >
                                    <input
                                        type="hidden"
                                        name="database"
                                        value={data.database}
                                    />

                                    <div className="fs-input-box">
                                        <Building2 className="fs-field-icon" size={18} aria-hidden="true" />
                                        <button
                                            type="button"
                                            id="database"
                                            className="fs-control fs-dropdown-trigger"
                                            onClick={() => {
                                                if (processing || isSuccess) return;
                                                setIsDropdownOpen((prev) => !prev);
                                            }}
                                            onFocus={() => setFocusedField('database')}
                                            onBlur={() => setFocusedField(null)}
                                            disabled={processing || isSuccess}
                                            aria-haspopup="listbox"
                                            aria-expanded={isDropdownOpen}
                                            aria-invalid={Boolean(databaseError)}
                                            aria-describedby={databaseError ? 'database-error' : undefined}
                                        >
                                            {data.database ? (
                                                <span className="fs-dropdown-selected-text">
                                                    <span className="fs-selected-db-code">
                                                        {databaseLabels[data.database] || data.database}
                                                    </span>
                                                    {databaseCompanies[data.database] && (
                                                        <span className="fs-selected-db-company">
                                                            {' '}— {databaseCompanies[data.database]}
                                                        </span>
                                                    )}
                                                </span>
                                            ) : (
                                                <span className="fs-dropdown-placeholder" />
                                            )}
                                        </button>
                                        <label htmlFor="database" className="fs-floating-label">
                                            Perusahaan / Database
                                        </label>
                                        <motion.div
                                            className="fs-chevron-wrapper"
                                            animate={{ rotate: isDropdownOpen ? 180 : 0 }}
                                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                                        >
                                            <ChevronDown className="fs-select-chevron" size={16} aria-hidden="true" />
                                        </motion.div>
                                    </div>

                                    {/* Animated Dropdown Menu Popover */}
                                    <AnimatePresence>
                                        {isDropdownOpen && (
                                            <motion.div
                                                className="fs-dropdown-menu"
                                                role="listbox"
                                                aria-label="Daftar Perusahaan / Database"
                                                initial={{ opacity: 0, y: -10, scale: 0.96 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                                                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                                            >
                                                <div className="fs-dropdown-menu-header">
                                                    <span className="fs-dropdown-menu-title">Pilih Unit Perusahaan</span>
                                                    <span className="fs-dropdown-menu-count">
                                                        {(databases.length > 0 ? databases : Object.keys(databaseLabels)).length} Database
                                                    </span>
                                                </div>

                                                <div className="fs-dropdown-items-list">
                                                    {(databases.length > 0 ? databases : Object.keys(databaseLabels)).map((dbKey) => {
                                                        const isSelected = data.database === dbKey;
                                                        const label = databaseLabels[dbKey] || dbKey;
                                                        const company = databaseCompanies[dbKey];

                                                        return (
                                                            <motion.button
                                                                key={dbKey}
                                                                type="button"
                                                                role="option"
                                                                aria-selected={isSelected}
                                                                className={`fs-dropdown-item ${isSelected ? 'is-selected' : ''}`}
                                                                onClick={() => {
                                                                    setData('database', dbKey);
                                                                    setIsDropdownOpen(false);
                                                                    setFocusedField(null);
                                                                }}
                                                                whileHover={{ x: 4, transition: { duration: 0.15 } }}
                                                                whileTap={{ scale: 0.98 }}
                                                            >
                                                                <div className="fs-dropdown-item-left">
                                                                    <div className={`fs-db-badge-icon ${isSelected ? 'is-active' : ''}`}>
                                                                        <Database size={15} />
                                                                    </div>
                                                                    <div className="fs-dropdown-item-meta">
                                                                        <span className="fs-dropdown-item-label">{label}</span>
                                                                        {company && (
                                                                            <span className="fs-dropdown-item-sub">{company}</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                {isSelected && (
                                                                    <motion.div
                                                                        className="fs-dropdown-item-check"
                                                                        initial={{ scale: 0, opacity: 0 }}
                                                                        animate={{ scale: 1, opacity: 1 }}
                                                                        transition={{ duration: 0.2 }}
                                                                    >
                                                                        <Check size={14} strokeWidth={2.8} />
                                                                    </motion.div>
                                                                )}
                                                            </motion.button>
                                                        );
                                                    })}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {databaseError && (
                                        <p className="fs-error-msg" id="database-error" role="alert">
                                            <AlertCircle size={12} />
                                            <span>{databaseError}</span>
                                        </p>
                                    )}
                                </motion.div>

                                {/* 2. Field Username dengan Animated Red Shake saat Autentikasi Salah */}
                                <motion.div
                                    className={`fs-field-group ${
                                        focusedField === 'pengguna' || Boolean(data.pengguna)
                                            ? 'is-active'
                                            : ''
                                    } ${hasAuthError ? 'has-error' : ''} ${isErrorShake ? 'fs-shake-active' : ''}`}
                                    initial={{ opacity: 0, y: 18 }}
                                    animate={
                                        isErrorShake
                                            ? { x: [0, -10, 10, -8, 8, -4, 4, 0], y: 0, opacity: 1 }
                                            : { x: 0, y: 0, opacity: 1 }
                                    }
                                    transition={{
                                        x: { duration: 0.55 },
                                        y: { duration: 0.5, delay: 0.45, ease: [0.16, 1, 0.3, 1] },
                                        opacity: { duration: 0.5, delay: 0.45 },
                                    }}
                                >
                                    <div className="fs-input-box">
                                        <UserRound className="fs-field-icon" size={18} aria-hidden="true" />
                                        <input
                                            id="pengguna"
                                            type="text"
                                            name="pengguna"
                                            value={data.pengguna}
                                            onChange={(e) => {
                                                setData('pengguna', e.target.value);
                                                if (customErrors.pengguna || customErrors.general) {
                                                    setCustomErrors((prev) => ({ ...prev, pengguna: undefined, general: undefined }));
                                                }
                                            }}
                                            onFocus={() => setFocusedField('pengguna')}
                                            onBlur={() => setFocusedField(null)}
                                            required
                                            autoComplete="username"
                                            autoCapitalize="none"
                                            autoCorrect="off"
                                            spellCheck={false}
                                            disabled={isSubmitting || processing || isSuccess}
                                            className={`fs-control ${hasAuthError ? 'is-error-shake' : ''}`}
                                            aria-invalid={Boolean(usernameError || hasAuthError)}
                                            aria-describedby={usernameError ? 'username-error' : undefined}
                                        />
                                        <label htmlFor="pengguna" className="fs-floating-label">
                                            Username
                                        </label>
                                    </div>
                                    {usernameError && (
                                        <p className="fs-error-msg" id="username-error" role="alert">
                                            <AlertCircle size={12} />
                                            <span>{usernameError}</span>
                                        </p>
                                    )}
                                </motion.div>

                                {/* 3. Field Password dengan Animated Red Shake saat Autentikasi Salah */}
                                <motion.div
                                    className={`fs-field-group ${
                                        focusedField === 'password' || Boolean(data.password)
                                            ? 'is-active'
                                            : ''
                                    } ${hasAuthError ? 'has-error' : ''} ${isErrorShake ? 'fs-shake-active' : ''}`}
                                    initial={{ opacity: 0, y: 18 }}
                                    animate={
                                        isErrorShake
                                            ? { x: [0, -10, 10, -8, 8, -4, 4, 0], y: 0, opacity: 1 }
                                            : { x: 0, y: 0, opacity: 1 }
                                    }
                                    transition={{
                                        x: { duration: 0.55 },
                                        y: { duration: 0.5, delay: 0.55, ease: [0.16, 1, 0.3, 1] },
                                        opacity: { duration: 0.5, delay: 0.55 },
                                    }}
                                >
                                    <div className="fs-input-box">
                                        <KeyRound className="fs-field-icon" size={18} aria-hidden="true" />
                                        <input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            name="password"
                                            value={data.password}
                                            onChange={(e) => {
                                                setData('password', e.target.value);
                                                if (customErrors.password || customErrors.general) {
                                                    setCustomErrors((prev) => ({ ...prev, password: undefined, general: undefined }));
                                                }
                                            }}
                                            onFocus={() => setFocusedField('password')}
                                            onBlur={() => {
                                                setFocusedField(null);
                                                setCapsLock(false);
                                            }}
                                            onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
                                            onKeyDown={(e) => setCapsLock(e.getModifierState('CapsLock'))}
                                            required
                                            autoComplete="current-password"
                                            disabled={isSubmitting || processing || isSuccess}
                                            className={`fs-control ${hasAuthError ? 'is-error-shake' : ''}`}
                                            aria-invalid={Boolean(passwordError || hasAuthError)}
                                            aria-describedby={passwordError ? 'password-error' : undefined}
                                        />
                                        <label htmlFor="password" className="fs-floating-label">
                                            Password
                                        </label>
                                        <button
                                            type="button"
                                            className="fs-pw-btn"
                                            onClick={() => setShowPassword((prev) => !prev)}
                                            aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                                            disabled={processing || isSuccess}
                                        >
                                            {showPassword ? (
                                                <EyeOff size={18} aria-hidden="true" />
                                            ) : (
                                                <Eye size={18} aria-hidden="true" />
                                            )}
                                        </button>
                                    </div>

                                    {passwordError && (
                                        <p className="fs-error-msg" id="password-error" role="alert">
                                            <AlertCircle size={12} />
                                            <span>{passwordError}</span>
                                        </p>
                                    )}

                                    <AnimatePresence>
                                        {capsLock && (
                                            <motion.div
                                                className="fs-caps-alert"
                                                role="status"
                                                initial={{ opacity: 0, y: -4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -4 }}
                                            >
                                                <AlertCircle size={12} />
                                                <span>Caps Lock Sedang Aktif</span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>

                                {/* Submit Button Masuk dengan Feedback Berhasil Login & Disabled */}
                                <motion.div
                                    initial={{ opacity: 0, y: 18 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: 0.65, ease: [0.16, 1, 0.3, 1] }}
                                >
                                    <motion.button
                                        type="submit"
                                        className={`fs-submit-btn ${isSuccess ? 'is-success' : ''}`}
                                        disabled={isSubmitting || processing || isSuccess}
                                        data-test="login-button"
                                        whileHover={{ scale: (isSubmitting || processing || isSuccess) ? 1 : 1.012 }}
                                        whileTap={{ scale: (isSubmitting || processing || isSuccess) ? 1 : 0.988 }}
                                    >
                                        {isSuccess ? (
                                            <motion.div
                                                key="success"
                                                className="fs-btn-content"
                                                initial={{ opacity: 0, y: 4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.25 }}
                                            >
                                                <motion.div
                                                    className="fs-success-badge"
                                                    initial={{ scale: 0, rotate: -60 }}
                                                    animate={{ scale: [0, 1.25, 1], rotate: 0 }}
                                                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                                                >
                                                    <Check size={17} strokeWidth={3} />
                                                </motion.div>
                                                <span className="fs-btn-text-success">Login Berhasil, Silahkan Tunggu...</span>
                                                <motion.div
                                                    className="fs-btn-progress-bar"
                                                    initial={{ width: '0%' }}
                                                    animate={{ width: '100%' }}
                                                    transition={{ duration: 1.0, ease: 'easeInOut' }}
                                                />
                                            </motion.div>
                                        ) : isSubmitting || processing ? (
                                            <>
                                                <span className="fs-spinner" aria-hidden="true" />
                                                <span>Menghubungkan ke Sistem...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Masuk ke Ruang Kerja</span>
                                                <ArrowRight className="fs-submit-arrow" size={17} aria-hidden="true" />
                                            </>
                                        )}
                                    </motion.button>
                                </motion.div>
                            </form>

                            {/* Spiritual Quote versi Mobile */}
                            <SpiritualQuoteCard mobile />
                        </div>

                        {/* Footer Bawah */}
                        <motion.div
                            className="fs-form-footer"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.6, delay: 0.8 }}
                        >
                            <span>&copy; {new Date().getFullYear()} i-System Enterprise</span>
                            <span>Secure & Encrypted</span>
                        </motion.div>
                    </motion.section>
                </div>
            </motion.div>
        </>
    );
}
