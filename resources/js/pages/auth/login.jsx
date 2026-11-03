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
import { useEffect, useState } from 'react';
import '../../../css/login.css';

const databaseLabels = {
    dbsja: 'DB SJA',
    dbbbbs: 'DB B3S',
    dbstg: 'DB STG',
    dbati: 'DB ATI',
    dbarm: 'DB ARM',
    dbjms: 'DB JMS',
};

/* ─── Animated Spiritual Quote Card ─────────────────────────────────────── */
function SpiritualQuoteCard({ mobile = false }) {
    return (
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
                <Sparkles size={13} aria-hidden="true" />
                <span>Niat Baik Bekerja</span>
            </div>
            <p className="fs-quote-title">
                Sebelum bekerja, <span>ucapkan bismillah.</span>
            </p>
            <p className="fs-quote-desc">
                Niatkan bekerja untuk mencari pahala, urusan rejeki bisa
                mengikuti dan mengalir dengan sendirinya.
            </p>
        </motion.div>
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

    // Track focused fields for animated floating labels
    const [focusedField, setFocusedField] = useState(null);

    // Authentication States: Sukses & Error Shake
    const [isSuccess, setIsSuccess] = useState(false);
    const [isErrorShake, setIsErrorShake] = useState(false);

    const pageErrors = page.props?.errors ?? {};
    const databaseError = errors.database || pageErrors.database;
    const usernameError = errors.pengguna || pageErrors.pengguna;
    const passwordError = errors.password || pageErrors.password;
    const flashError = page.props?.flash?.error;

    const hasAuthError = Boolean(usernameError || passwordError || flashError);

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

    const submit = (event) => {
        event.preventDefault();
        if (processing || isSuccess) return;

        post('/login-simple', {
            onSuccess: () => {
                setIsSuccess(true);
            },
            onError: () => {
                triggerErrorShake();
            },
            onFinish: () => {
                reset('password');
                setShowPassword(false);
                setCapsLock(false);
            },
        });
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
                                {/* 1. Dropdown Perusahaan / Database */}
                                <motion.div
                                    className={`fs-field-group ${
                                        focusedField === 'database' || Boolean(data.database)
                                            ? 'is-active'
                                            : ''
                                    }`}
                                    initial={{ opacity: 0, y: 18 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
                                >
                                    <div className="fs-input-box">
                                        <Building2 className="fs-field-icon" size={18} aria-hidden="true" />
                                        <select
                                            id="database"
                                            name="database"
                                            required
                                            value={data.database}
                                            onChange={(e) => setData('database', e.target.value)}
                                            onFocus={() => setFocusedField('database')}
                                            onBlur={() => setFocusedField(null)}
                                            disabled={processing}
                                            data-empty={!data.database}
                                            className="fs-control"
                                            aria-invalid={Boolean(databaseError)}
                                            aria-describedby={databaseError ? 'database-error' : undefined}
                                        >
                                            <option value="" disabled></option>
                                            {databases.map((database) => (
                                                <option key={database} value={database}>
                                                    {databaseLabels[database] || database}
                                                </option>
                                            ))}
                                        </select>
                                        <label htmlFor="database" className="fs-floating-label">
                                            Perusahaan / Database
                                        </label>
                                        <ChevronDown className="fs-select-chevron" size={16} aria-hidden="true" />
                                    </div>
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
                                            onChange={(e) => setData('pengguna', e.target.value)}
                                            onFocus={() => setFocusedField('pengguna')}
                                            onBlur={() => setFocusedField(null)}
                                            required
                                            autoComplete="username"
                                            autoCapitalize="none"
                                            autoCorrect="off"
                                            spellCheck={false}
                                            disabled={processing || isSuccess}
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
                                            onChange={(e) => setData('password', e.target.value)}
                                            onFocus={() => setFocusedField('password')}
                                            onBlur={() => {
                                                setFocusedField(null);
                                                setCapsLock(false);
                                            }}
                                            onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
                                            onKeyDown={(e) => setCapsLock(e.getModifierState('CapsLock'))}
                                            required
                                            autoComplete="current-password"
                                            disabled={processing || isSuccess}
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
                                        disabled={processing || isSuccess}
                                        data-test="login-button"
                                        whileHover={{ scale: (processing || isSuccess) ? 1 : 1.012 }}
                                        whileTap={{ scale: (processing || isSuccess) ? 1 : 0.988 }}
                                    >
                                        {isSuccess ? (
                                            <>
                                                <Check size={18} strokeWidth={2.8} />
                                                <span>Berhasil Login!</span>
                                            </>
                                        ) : processing ? (
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
