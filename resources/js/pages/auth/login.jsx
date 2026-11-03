import AppLogoIcon from '@/components/app-logo-icon';
import { useAppearance } from '@/hooks/use-appearance';
import { store } from '@/routes/login-store';
import { Head, useForm, usePage } from '@inertiajs/react';
import {
    Activity,
    AlertCircle,
    ArrowRight,
    Building2,
    Calendar,
    ChevronDown,
    Clock,
    Eye,
    EyeOff,
    KeyRound,
    Moon,
    Package,
    ShieldCheck,
    Sparkles,
    Sun,
    TrendingUp,
    UserRound,
    Wallet,
    Zap,
} from 'lucide-react';
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

/* ─── Real-Time Clock & Date ────────────────────────────────────────────── */
function LiveClockDisplay() {
    const [time, setTime] = useState(() => new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    const pad = (num) => String(num).padStart(2, '0');
    const dayName = days[time.getDay()];
    const dateStr = `${time.getDate()} ${months[time.getMonth()]} ${time.getFullYear()}`;
    const timeStr = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;

    return (
        <div className="is-live-clock" title="Waktu Sistem Saat Ini" aria-hidden="true">
            <Clock size={13} />
            <span>
                {dayName}, {dateStr} · {timeStr}
            </span>
        </div>
    );
}

/* ─── Dynamic Greeting Generator ────────────────────────────────────────── */
function getGreeting() {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 11) {
        return {
            title: 'Selamat Pagi, Semangat Baru!',
            subtitle: 'Awali hari dengan niat terbaik dan penuh dedikasi.',
        };
    }
    if (hour >= 11 && hour < 15) {
        return {
            title: 'Selamat Siang, Tetap Produktif!',
            subtitle: 'Jaga fokus dan selesaikan target hari ini dengan cermat.',
        };
    }
    if (hour >= 15 && hour < 18) {
        return {
            title: 'Selamat Sore, Tuntaskan Hari!',
            subtitle: 'Evaluasi pencapaian kerja hari ini dengan penuh rasa syukur.',
        };
    }
    return {
        title: 'Selamat Malam, Kerja Penuh Berkah!',
        subtitle: 'Teruslah berkarya dengan integritas dan ketenangan hati.',
    };
}

/* ─── Spiritual & Motivational Card ─────────────────────────────────────── */
function SpiritualCard({ mobile = false }) {
    return (
        <div className={mobile ? 'is-spiritual-card-mobile' : 'is-spiritual-card'}>
            <div className="is-spiritual-eyebrow">
                <Sparkles size={14} aria-hidden="true" />
                <span>Awali Dengan Niat Baik</span>
            </div>
            <p className="is-spiritual-quote">
                Sebelum bekerja, <span>ucapkan bismillah.</span>
            </p>
            <p className="is-spiritual-sub">
                Niatkan bekerja untuk mencari pahala, urusan rejeki bisa
                mengikuti dan mengalir dengan sendirinya.
            </p>
        </div>
    );
}

/* ─── Animated Ambient Background ───────────────────────────────────────── */
function AmbientBackground() {
    return (
        <div className="is-ambient-bg" aria-hidden="true">
            <div className="is-ambient-grid" />
            <div className="is-aurora-orb is-orb-1" />
            <div className="is-aurora-orb is-orb-2" />
            <div className="is-aurora-orb is-orb-3" />
            <span className="is-particle-spark is-spark-1" />
            <span className="is-particle-spark is-spark-2" />
            <span className="is-particle-spark is-spark-3" />
            <span className="is-particle-spark is-spark-4" />
            <span className="is-particle-spark is-spark-5" />
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
    const [greeting, setGreeting] = useState(() => getGreeting());

    useEffect(() => {
        setGreeting(getGreeting());
    }, []);

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

    // Toggle Theme (Light <-> Dark) syncs with app settings
    const toggleTheme = () => {
        const nextTheme = appearance === 'dark' ? 'light' : 'dark';
        updateAppearance(nextTheme);
    };

    return (
        <>
            <Head title="Masuk ke i-System" />
            <div className="is-login-root">
                <AmbientBackground />

                {/* ── Top Navigation / Brand Header ─────────────────────── */}
                <header className="is-login-header">
                    <a href="/" className="is-brand-group" aria-label="Halaman Utama i-System">
                        <div className="is-brand-logo-wrap">
                            <AppLogoIcon className="is-brand-logo-img" />
                        </div>
                        <div className="is-brand-title">
                            <div className="is-brand-name">
                                <span>i-System</span>
                                <span className="is-badge-ver">Enterprise</span>
                            </div>
                            <span className="is-brand-sub">Integrated Resource Platform</span>
                        </div>
                    </a>

                    <div className="is-header-actions">
                        {/* Server Live Status */}
                        <div className="is-status-pill" title="Status Server Operasional">
                            <span className="is-pulse-dot" aria-hidden="true" />
                            <span>Sistem Online</span>
                        </div>

                        {/* Theme Toggle Button (Syncs with settings menu) */}
                        <button
                            type="button"
                            className="is-theme-toggle"
                            onClick={toggleTheme}
                            title={`Ganti ke mode ${appearance === 'dark' ? 'terang' : 'gelap'}`}
                            aria-label="Ubah tema tampilan"
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
                        </button>

                        {/* Live Clock Widget */}
                        <LiveClockDisplay />
                    </div>
                </header>

                {/* ── Main Workspace Card ───────────────────────────────── */}
                <main className="is-workspace-container">
                    <div className="is-card-shell">
                        {/* ── Kolom Kiri: Hero & Inspirasi Kerja ─────────────── */}
                        <section className="is-hero-panel" aria-label="Inspirasi dan Ekosistem i-System">
                            <div className="is-hero-content">
                                <div className="is-greeting-badge">
                                    <Zap size={13} aria-hidden="true" />
                                    <span>{greeting.title}</span>
                                </div>

                                <h2 className="is-hero-title">
                                    Langkah yang baik.
                                    <br />
                                    <span>Hasil yang berarti.</span>
                                </h2>
                                <p className="is-hero-sub">
                                    {greeting.subtitle} Nikmati kemudahan kendali
                                    operasional bisnis dalam satu platform terpadu.
                                </p>
                            </div>

                            {/* Spiritual Quote Card (Tetap Dipertahankan) */}
                            <SpiritualCard />

                            {/* Animated Enterprise Modules Showcase */}
                            <div className="is-eco-visual" aria-hidden="true">
                                <div className="is-eco-header">
                                    <span>Modul Terintegrasi</span>
                                    <span className="is-eco-status-tag">
                                        <Activity size={13} />
                                        <span>Aktif & Sinkron</span>
                                    </span>
                                </div>
                                <div className="is-eco-modules">
                                    <div className="is-module-chip">
                                        <div className="is-module-icon">
                                            <TrendingUp size={16} />
                                        </div>
                                        <span className="is-module-name">Penjualan</span>
                                        <span className="is-module-status">Order & Tagihan</span>
                                    </div>
                                    <div className="is-module-chip">
                                        <div className="is-module-icon">
                                            <Package size={16} />
                                        </div>
                                        <span className="is-module-name">Persediaan</span>
                                        <span className="is-module-status">Stok Real-time</span>
                                    </div>
                                    <div className="is-module-chip">
                                        <div className="is-module-icon">
                                            <Wallet size={16} />
                                        </div>
                                        <span className="is-module-name">Keuangan</span>
                                        <span className="is-module-status">Arus Kas & GL</span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* ── Kolom Kanan: Form Masuk Akun ──────────────────── */}
                        <section className="is-form-panel" aria-labelledby="login-heading">
                            <div className="is-form-inner">
                                <div className="is-form-header">
                                    <div className="is-form-badge">
                                        <ShieldCheck size={12} aria-hidden="true" />
                                        <span>Portal Akses Karyawan</span>
                                    </div>
                                    <h1 id="login-heading" className="is-form-title">
                                        Selamat Datang.
                                    </h1>
                                    <p className="is-form-desc">
                                        Silakan pilih perusahaan dan masukkan kredensial akun
                                        Anda untuk melanjutkan ke ruang kerja.
                                    </p>
                                </div>

                                {/* Flash Error Alert */}
                                {flashError && (
                                    <div className="is-alert-banner is-alert-banner-error" role="alert">
                                        <AlertCircle size={16} aria-hidden="true" />
                                        <span>{flashError}</span>
                                    </div>
                                )}

                                {/* Status Success Alert */}
                                {status && (
                                    <div className="is-alert-banner is-alert-banner-success" role="status">
                                        <Sparkles size={16} aria-hidden="true" />
                                        <span>{status}</span>
                                    </div>
                                )}

                                {/* Form Input */}
                                <form onSubmit={submit} className="is-form-body" aria-busy={processing}>
                                    {/* 1. Database / Perusahaan */}
                                    <div className="is-form-row">
                                        <label htmlFor="database" className="is-field-label">
                                            Perusahaan <span>/ Database</span>
                                        </label>
                                        <div className="is-input-wrap">
                                            <Building2 className="is-input-icon" size={18} aria-hidden="true" />
                                            <select
                                                id="database"
                                                name="database"
                                                required
                                                value={data.database}
                                                onChange={(e) => setData('database', e.target.value)}
                                                disabled={processing}
                                                data-empty={!data.database}
                                                className="is-input-control"
                                                aria-invalid={Boolean(databaseError)}
                                                aria-describedby={databaseError ? 'database-error' : undefined}
                                            >
                                                <option value="" disabled>
                                                    Pilih perusahaan kerja Anda
                                                </option>
                                                {databases.map((database) => (
                                                    <option key={database} value={database}>
                                                        {databaseLabels[database] || database}
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronDown className="is-select-chevron" size={16} aria-hidden="true" />
                                        </div>
                                        {databaseError && (
                                            <p className="is-field-error-text" id="database-error" role="alert">
                                                <AlertCircle size={13} />
                                                <span>{databaseError}</span>
                                            </p>
                                        )}
                                    </div>

                                    {/* 2. Username Pengguna */}
                                    <div className="is-form-row">
                                        <label htmlFor="pengguna" className="is-field-label">
                                            Username
                                        </label>
                                        <div className="is-input-wrap">
                                            <UserRound className="is-input-icon" size={18} aria-hidden="true" />
                                            <input
                                                id="pengguna"
                                                type="text"
                                                name="pengguna"
                                                value={data.pengguna}
                                                onChange={(e) => setData('pengguna', e.target.value)}
                                                required
                                                autoComplete="username"
                                                autoCapitalize="none"
                                                autoCorrect="off"
                                                spellCheck={false}
                                                placeholder="Masukkan username Anda"
                                                disabled={processing}
                                                className="is-input-control"
                                                aria-invalid={Boolean(usernameError)}
                                                aria-describedby={usernameError ? 'username-error' : undefined}
                                            />
                                        </div>
                                        {usernameError && (
                                            <p className="is-field-error-text" id="username-error" role="alert">
                                                <AlertCircle size={13} />
                                                <span>{usernameError}</span>
                                            </p>
                                        )}
                                    </div>

                                    {/* 3. Password */}
                                    <div className="is-form-row">
                                        <label htmlFor="password" className="is-field-label">
                                            Password
                                        </label>
                                        <div className="is-input-wrap">
                                            <KeyRound className="is-input-icon" size={18} aria-hidden="true" />
                                            <input
                                                id="password"
                                                type={showPassword ? 'text' : 'password'}
                                                name="password"
                                                value={data.password}
                                                onChange={(e) => setData('password', e.target.value)}
                                                onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
                                                onKeyDown={(e) => setCapsLock(e.getModifierState('CapsLock'))}
                                                onBlur={() => setCapsLock(false)}
                                                required
                                                autoComplete="current-password"
                                                placeholder="Masukkan password Anda"
                                                disabled={processing}
                                                className="is-input-control"
                                                aria-invalid={Boolean(passwordError)}
                                                aria-describedby={passwordError ? 'password-error' : undefined}
                                            />
                                            <button
                                                type="button"
                                                className="is-toggle-pw"
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
                                            <p className="is-field-error-text" id="password-error" role="alert">
                                                <AlertCircle size={13} />
                                                <span>{passwordError}</span>
                                            </p>
                                        )}

                                        {capsLock && (
                                            <div className="is-capslock-badge" role="status">
                                                <AlertCircle size={13} />
                                                <span>Perhatian: Caps Lock Sedang Aktif</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Submit Button */}
                                    <button
                                        type="submit"
                                        className="is-submit-btn"
                                        disabled={processing}
                                        data-test="login-button"
                                    >
                                        <span>
                                            {processing ? 'Menghubungkan ke Sistem...' : 'Masuk ke Ruang Kerja'}
                                        </span>
                                        {processing ? (
                                            <span className="is-spinner-circle" aria-hidden="true" />
                                        ) : (
                                            <ArrowRight className="is-submit-arrow" size={18} aria-hidden="true" />
                                        )}
                                    </button>
                                </form>

                                {/* Security / Help Note */}
                                <div className="is-security-note">
                                    <ShieldCheck size={18} aria-hidden="true" />
                                    <span>
                                        Gunakan akun resmi yang diterbitkan oleh administrator.
                                        Sesi kerja Anda terenkripsi dan terlindungi.
                                    </span>
                                </div>

                                {/* Spiritual Card for Mobile Devices */}
                                <SpiritualCard mobile />
                            </div>
                        </section>
                    </div>
                </main>

                {/* ── Footer ───────────────────────────────────────────── */}
                <footer className="is-login-footer">
                    <span>
                        &copy; {new Date().getFullYear()} i-System Enterprise. Dibangun untuk pekerjaan yang berarti.
                    </span>
                    <div className="is-footer-links">
                        <span className="is-footer-link">Bekerja dengan Integritas</span>
                        <span>·</span>
                        <span className="is-footer-link">Support: IT Helpdesk</span>
                    </div>
                </footer>
            </div>
        </>
    );
}
