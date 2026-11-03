import AppLogoIcon from '@/components/app-logo-icon';
import { useAppearance } from '@/hooks/use-appearance';
import { store } from '@/routes/login-store';
import { Head, useForm, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowRight,
    Building2,
    ChevronDown,
    Cpu,
    Eye,
    EyeOff,
    KeyRound,
    Layers,
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
import { useState } from 'react';
import '../../../css/login.css';

const databaseLabels = {
    dbsja: 'DB SJA',
    dbbbbs: 'DB B3S',
    dbstg: 'DB STG',
    dbati: 'DB ATI',
    dbarm: 'DB ARM',
    dbjms: 'DB JMS',
};

/* ─── Animated Ambient Background ───────────────────────────────────────── */
function AmbientBackground() {
    return (
        <div className="ml-ambient-canvas" aria-hidden="true">
            <div className="ml-grid-mesh" />
            <motion.div
                className="ml-glow-orb ml-orb-teal"
                animate={{
                    x: [0, 40, -30, 0],
                    y: [0, -30, 30, 0],
                    scale: [1, 1.1, 0.95, 1],
                }}
                transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
                className="ml-glow-orb ml-orb-blue"
                animate={{
                    x: [0, -40, 35, 0],
                    y: [0, 35, -25, 0],
                    scale: [1, 1.08, 0.92, 1],
                }}
                transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
            />
            <motion.div
                className="ml-glow-orb ml-orb-purple"
                animate={{
                    x: [0, 30, -40, 0],
                    y: [0, -25, 35, 0],
                    scale: [1, 1.12, 0.9, 1],
                }}
                transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
            />
        </div>
    );
}

/* ─── Spiritual & Motivational Card ─────────────────────────────────────── */
function SpiritualQuoteBanner({ mobile = false }) {
    return (
        <motion.div
            className={mobile ? 'ml-quote-banner-mobile' : 'ml-quote-banner'}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
        >
            <div className="ml-quote-eyebrow">
                <Sparkles size={14} aria-hidden="true" />
                <span>Niat Baik Bekerja</span>
            </div>
            <p className="ml-quote-text">
                Sebelum bekerja, <span>ucapkan bismillah.</span>
            </p>
            <p className="ml-quote-sub">
                Niatkan bekerja untuk mencari pahala, urusan rejeki bisa
                mengikuti dan mengalir dengan sendirinya.
            </p>
        </motion.div>
    );
}

/* ─── Modern Cyber Core Showcase ────────────────────────────────────────── */
function CyberCoreVisual() {
    return (
        <div className="ml-core-visual-wrap" aria-hidden="true">
            {/* Outer Orbit Ring 2 */}
            <motion.div
                className="ml-orbit-ring ml-ring-2"
                animate={{ rotate: -360 }}
                transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
            />

            {/* Inner Orbit Ring 1 */}
            <motion.div
                className="ml-orbit-ring ml-ring-1"
                animate={{ rotate: 360 }}
                transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
            />

            {/* Center Core Node */}
            <motion.div
                className="ml-core-center"
                animate={{
                    scale: [1, 1.04, 1],
                    boxShadow: [
                        '0 0 25px rgba(16, 185, 129, 0.25)',
                        '0 0 45px rgba(16, 185, 129, 0.45)',
                        '0 0 25px rgba(16, 185, 129, 0.25)',
                    ],
                }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            >
                <Cpu size={32} />
                <span>i-System</span>
            </motion.div>

            {/* Satellite Badge: Penjualan */}
            <motion.div
                className="ml-satellite-tag top-left"
                animate={{ y: [-4, 4, -4] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
                <TrendingUp size={13} color="#34d399" />
                <span>Penjualan</span>
            </motion.div>

            {/* Satellite Badge: Persediaan */}
            <motion.div
                className="ml-satellite-tag bottom-left"
                animate={{ y: [4, -4, 4] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            >
                <Package size={13} color="#38bdf8" />
                <span>Persediaan</span>
            </motion.div>

            {/* Satellite Badge: Keuangan */}
            <motion.div
                className="ml-satellite-tag bottom-right"
                animate={{ y: [-3, 5, -3] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
            >
                <Wallet size={13} color="#a78bfa" />
                <span>Keuangan</span>
            </motion.div>
        </div>
    );
}

/* ─── Main Login Component ──────────────────────────────────────────────── */
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

    // Track field focuses for animated morphing labels
    const [focusedField, setFocusedField] = useState(null);

    const pageErrors = page.props?.errors ?? {};
    const databaseError = errors.database || pageErrors.database;
    const usernameError = errors.pengguna || pageErrors.pengguna;
    const passwordError = errors.password || pageErrors.password;
    const flashError = page.props?.flash?.error;

    const submit = (event) => {
        event.preventDefault();
        if (processing) return;
        post('/login-simple', {
            onFinish: () => {
                reset('password');
                setShowPassword(false);
                setCapsLock(false);
            },
        });
    };

    // Toggle Theme (Light <-> Dark mode) sync with settings
    const toggleTheme = () => {
        const nextTheme = appearance === 'dark' ? 'light' : 'dark';
        updateAppearance(nextTheme);
    };

    return (
        <>
            <Head title="Masuk - i-System" />
            <div className="modern-login-page">
                <AmbientBackground />

                {/* ── Topbar / Brand Header ─────────────────────────────── */}
                <header className="ml-topbar">
                    <a href="/" className="ml-brand-link" aria-label="Halaman Utama i-System">
                        <div className="ml-logo-box">
                            <AppLogoIcon className="ml-logo-img" />
                        </div>
                        <div className="ml-brand-text">
                            <h1>i-System</h1>
                            <span>Enterprise Resource Planning</span>
                        </div>
                    </a>

                    <div className="ml-topbar-controls">
                        {/* Theme Toggle Button (Syncs with settings menu) */}
                        <motion.button
                            type="button"
                            className="ml-theme-switch"
                            onClick={toggleTheme}
                            title={`Ganti ke mode ${appearance === 'dark' ? 'terang' : 'gelap'}`}
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.96 }}
                        >
                            {appearance === 'dark' ? (
                                <>
                                    <Sun size={14} aria-hidden="true" />
                                    <span>Terang</span>
                                </>
                            ) : (
                                <>
                                    <Moon size={14} aria-hidden="true" />
                                    <span>Gelap</span>
                                </>
                            )}
                        </motion.button>
                    </div>
                </header>

                {/* ── Main Workspace Glass Card ─────────────────────────── */}
                <main className="ml-workspace-wrap">
                    <motion.div
                        className="ml-glass-card"
                        initial={{ opacity: 0, y: 24, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <div className="ml-card-beam-border" aria-hidden="true" />

                        {/* ── Kolom Kiri: Visual Cyber Core & Spiritual Quote ── */}
                        <section className="ml-hero-panel" aria-label="Visualisasi dan Inspirasi">
                            {/* Animated 3D Cyber Core Nodes */}
                            <CyberCoreVisual />

                            {/* Spiritual Motivational Quote (Tetap Dipertahankan) */}
                            <SpiritualQuoteBanner />
                        </section>

                        {/* ── Kolom Kanan: Form dengan Animated Floating Labels ── */}
                        <section className="ml-form-panel" aria-labelledby="form-heading">
                            <div className="ml-form-inner">
                                <div className="ml-form-header">
                                    <div className="ml-form-badge">
                                        <Layers size={11} aria-hidden="true" />
                                        <span>Portal Akses</span>
                                    </div>
                                    <h2 id="form-heading" className="ml-form-title">
                                        Selamat Datang.
                                    </h2>
                                    <p className="ml-form-subtitle">
                                        Silakan pilih perusahaan dan masukkan akun Anda.
                                    </p>
                                </div>

                                {/* Flash Error Alert */}
                                <AnimatePresence>
                                    {flashError && (
                                        <motion.div
                                            className="ml-alert-box ml-alert-error"
                                            role="alert"
                                            initial={{ opacity: 0, y: -8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -8 }}
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
                                            className="ml-alert-box ml-alert-success"
                                            role="status"
                                            initial={{ opacity: 0, y: -8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -8 }}
                                        >
                                            <Sparkles size={15} />
                                            <span>{status}</span>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Login Form with Floating Animated Labels */}
                                <form onSubmit={submit} className="ml-form-stack" aria-busy={processing}>
                                    {/* 1. Field Dropdown Perusahaan / Database */}
                                    <div
                                        className={`ml-floating-field ${
                                            focusedField === 'database' || Boolean(data.database)
                                                ? 'is-active'
                                                : ''
                                        }`}
                                    >
                                        <div className="ml-floating-box">
                                            <Building2 className="ml-field-icon" size={18} aria-hidden="true" />
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
                                                className="ml-floating-input"
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
                                            <label htmlFor="database" className="ml-floating-label">
                                                Perusahaan / Database
                                            </label>
                                            <ChevronDown className="ml-select-arrow" size={16} aria-hidden="true" />
                                        </div>
                                        {databaseError && (
                                            <p className="ml-error-pill" id="database-error" role="alert">
                                                <AlertCircle size={12} />
                                                <span>{databaseError}</span>
                                            </p>
                                        )}
                                    </div>

                                    {/* 2. Field Username */}
                                    <div
                                        className={`ml-floating-field ${
                                            focusedField === 'pengguna' || Boolean(data.pengguna)
                                                ? 'is-active'
                                                : ''
                                        }`}
                                    >
                                        <div className="ml-floating-box">
                                            <UserRound className="ml-field-icon" size={18} aria-hidden="true" />
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
                                                disabled={processing}
                                                className="ml-floating-input"
                                                aria-invalid={Boolean(usernameError)}
                                                aria-describedby={usernameError ? 'username-error' : undefined}
                                            />
                                            <label htmlFor="pengguna" className="ml-floating-label">
                                                Username
                                            </label>
                                        </div>
                                        {usernameError && (
                                            <p className="ml-error-pill" id="username-error" role="alert">
                                                <AlertCircle size={12} />
                                                <span>{usernameError}</span>
                                            </p>
                                        )}
                                    </div>

                                    {/* 3. Field Password */}
                                    <div
                                        className={`ml-floating-field ${
                                            focusedField === 'password' || Boolean(data.password)
                                                ? 'is-active'
                                                : ''
                                        }`}
                                    >
                                        <div className="ml-floating-box">
                                            <KeyRound className="ml-field-icon" size={18} aria-hidden="true" />
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
                                                disabled={processing}
                                                className="ml-floating-input"
                                                aria-invalid={Boolean(passwordError)}
                                                aria-describedby={passwordError ? 'password-error' : undefined}
                                            />
                                            <label htmlFor="password" className="ml-floating-label">
                                                Password
                                            </label>
                                            <button
                                                type="button"
                                                className="ml-pw-toggle"
                                                onClick={() => setShowPassword((prev) => !prev)}
                                                aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                                                disabled={processing}
                                            >
                                                {showPassword ? (
                                                    <EyeOff size={18} aria-hidden="true" />
                                                ) : (
                                                    <Eye size={18} aria-hidden="true" />
                                                )}
                                            </button>
                                        </div>

                                        {passwordError && (
                                            <p className="ml-error-pill" id="password-error" role="alert">
                                                <AlertCircle size={12} />
                                                <span>{passwordError}</span>
                                            </p>
                                        )}

                                        <AnimatePresence>
                                            {capsLock && (
                                                <motion.div
                                                    className="ml-capslock-pill"
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
                                    </div>

                                    {/* Submit Button */}
                                    <motion.button
                                        type="submit"
                                        className="ml-submit-button"
                                        disabled={processing}
                                        data-test="login-button"
                                        whileHover={{ scale: processing ? 1 : 1.015 }}
                                        whileTap={{ scale: processing ? 1 : 0.985 }}
                                    >
                                        <span>
                                            {processing ? 'Menghubungkan...' : 'Masuk ke Ruang Kerja'}
                                        </span>
                                        {processing ? (
                                            <span className="ml-spinner" aria-hidden="true" />
                                        ) : (
                                            <ArrowRight className="ml-submit-arrow" size={17} aria-hidden="true" />
                                        )}
                                    </motion.button>
                                </form>

                                {/* Spiritual Quote for Mobile Viewports */}
                                <SpiritualQuoteBanner mobile />
                            </div>
                        </section>
                    </motion.div>
                </main>

                {/* ── Footer ───────────────────────────────────────────── */}
                <footer className="ml-footer">
                    <span>&copy; {new Date().getFullYear()} i-System</span>
                    <span>IT Enterprise System</span>
                </footer>
            </div>
        </>
    );
}
