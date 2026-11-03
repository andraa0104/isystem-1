import AppLogoIcon from '@/components/app-logo-icon';
import { store } from '@/routes/login-store';
import { Head, useForm, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    Building2,
    ChevronDown,
    Eye,
    EyeOff,
    KeyRound,
    Layers3,
    Package,
    ShieldCheck,
    Sparkles,
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

/* ─── Clock widget ─────────────────────────────────────────────────────── */
function LiveClock() {
    const [time, setTime] = useState(() => new Date());
    useEffect(() => {
        const id = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(id);
    }, []);
    const pad = (n) => String(n).padStart(2, '0');
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
    return (
        <div className="login-clock" aria-live="off" aria-hidden="true">
            {days[time.getDay()]}, {time.getDate()} {months[time.getMonth()]} {time.getFullYear()}
            &ensp;·&ensp;
            {pad(time.getHours())}:{pad(time.getMinutes())}:{pad(time.getSeconds())}
        </div>
    );
}

/* ─── Intention note ────────────────────────────────────────────────────── */
function IntentionNote({ compact = false }) {
    return (
        <aside
            className={
                compact
                    ? 'login-intention login-intention-mobile'
                    : 'login-intention'
            }
        >
            <div className="login-eyebrow login-intention-label">
                <Sparkles size={13} aria-hidden="true" />
                AWALI DENGAN NIAT BAIK
            </div>
            <p className="login-intention-title">
                Sebelum bekerja, <span>ucapkan bismillah.</span>
            </p>
            <p className="login-intention-copy">
                Niatkan bekerja untuk mencari pahala, urusan rejeki bisa
                mengikuti dan mengalir dengan sendirinya.
            </p>
        </aside>
    );
}

/* ─── Stats row ─────────────────────────────────────────────────────────── */
function StatsRow() {
    return (
        <div className="login-stats" aria-hidden="true">
            <div className="login-stat">
                <div className="login-stat-value">6</div>
                <div className="login-stat-label">Perusahaan</div>
            </div>
            <div className="login-stat">
                <div className="login-stat-value">3</div>
                <div className="login-stat-label">Modul Utama</div>
            </div>
            <div className="login-stat">
                <div className="login-stat-value">1</div>
                <div className="login-stat-label">Platform ERP</div>
            </div>
        </div>
    );
}

/* ─── Workspace visual (animated SVG diagram) ───────────────────────────── */
function WorkspaceVisual() {
    return (
        <div className="login-visual" aria-hidden="true">
            {/* Animated connection lines */}
            <svg
                className="login-connections"
                viewBox="0 0 480 184"
                fill="none"
                preserveAspectRatio="xMidYMid meet"
            >
                {/* Trunk lines */}
                <path
                    className="login-conn-line"
                    d="M240 64V90M240 90H77V130M240 90V130M240 90H403V130"
                    stroke="#00d4aa"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                />
                {/* Branch glow lines */}
                <path
                    className="login-conn-glow"
                    d="M77 120V130M240 120V130M403 120V130"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeLinecap="round"
                />
                {/* Hub pulse circle */}
                <circle cx="240" cy="90" r="5" fill="#00d4aa" opacity="0.9">
                    <animate
                        attributeName="r"
                        values="4;7;4"
                        dur="2.5s"
                        repeatCount="indefinite"
                    />
                    <animate
                        attributeName="opacity"
                        values="0.9;0.3;0.9"
                        dur="2.5s"
                        repeatCount="indefinite"
                    />
                </circle>
                {/* Node dots */}
                <circle cx="77" cy="130" r="3" fill="#3b82f6" opacity="0.8" />
                <circle cx="240" cy="130" r="3" fill="#3b82f6" opacity="0.8" />
                <circle cx="403" cy="130" r="3" fill="#3b82f6" opacity="0.8" />
            </svg>

            {/* Hub chip */}
            <div className="login-flow-hub">
                <Layers3 size={18} />
                <span>i-System</span>
                <span className="login-flow-dot" />
            </div>

            {/* Module chips */}
            <div className="login-flow-modules">
                <div>
                    <TrendingUp size={15} />
                    <span>Penjualan</span>
                </div>
                <div>
                    <Package size={15} />
                    <span>Persediaan</span>
                </div>
                <div>
                    <Wallet size={15} />
                    <span>Keuangan</span>
                </div>
            </div>

            <p className="login-visual-caption">SATU ALUR · SEMUA TERHUBUNG</p>
        </div>
    );
}

/* ─── Animated background canvas ───────────────────────────────────────── */
function BackgroundCanvas() {
    return (
        <div className="login-bg-canvas" aria-hidden="true">
            <div className="login-grid" />
            <div className="login-blob login-blob-1" />
            <div className="login-blob login-blob-2" />
            <div className="login-blob login-blob-3" />
            {[1,2,3,4,5,6,7,8].map((i) => (
                <span key={i} className="login-particle" />
            ))}
        </div>
    );
}

/* ─── Main login page ───────────────────────────────────────────────────── */
export default function Login({ status, databases = [], selectedDatabase }) {
    const page = usePage();
    const defaultDatabase = databases.includes(selectedDatabase)
        ? selectedDatabase
        : '';
    const { data, setData, post, processing, errors, reset } = useForm({
        ...store.form(),
        database: defaultDatabase,
    });
    const [showPassword, setShowPassword] = useState(false);
    const [capsLock, setCapsLock] = useState(false);
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

    return (
        <>
            <Head title="Masuk" />
            <BackgroundCanvas />

            <div className="login-page">
                {/* ── Top bar ──────────────────────────────────────────── */}
                <header className="login-topbar">
                    <a
                        className="login-brand"
                        href="/"
                        aria-label="i-System, halaman utama"
                    >
                        <AppLogoIcon className="login-brand-icon" />
                        <span className="login-brand-text">
                            <strong>i-System</strong>
                            <small>Enterprise Resource Planning</small>
                        </span>
                    </a>

                    <div className="login-topbar-badge" aria-hidden="true">
                        <span className="login-topbar-badge-dot" />
                        Sistem Online
                    </div>
                </header>

                {/* ── Main card ────────────────────────────────────────── */}
                <main className="login-workspace">

                    {/* Left: story panel */}
                    <section
                        className="login-story"
                        aria-label="Selamat datang di i-System"
                    >
                        <div className="login-story-heading">
                            <div className="login-eyebrow">
                                <Zap size={12} aria-hidden="true" />
                                RUANG KERJA TERINTEGRASI
                            </div>
                            <h2>
                                Langkah yang baik.
                                <br />
                                <span>Hasil yang berarti.</span>
                            </h2>
                            <p>
                                Kelola bisnis dengan lebih terarah. Dari
                                penjualan, persediaan, hingga keuangan dalam
                                satu ruang kerja.
                            </p>
                        </div>

                        <StatsRow />
                        <WorkspaceVisual />
                        <IntentionNote />

                        <span
                            className="login-story-orbit login-story-orbit-one"
                            aria-hidden="true"
                        />
                        <span
                            className="login-story-orbit login-story-orbit-two"
                            aria-hidden="true"
                        />
                    </section>

                    {/* Right: form panel */}
                    <section
                        className="login-access"
                        aria-labelledby="login-title"
                    >
                        <div className="login-form-container">
                            <LiveClock />

                            <div className="login-access-label">
                                <span />
                                <span>AKSES WORKSPACE</span>
                            </div>
                            <h1 id="login-title">Selamat datang.</h1>
                            <p className="login-description">
                                Siap memulai hari yang produktif?
                                <br />
                                Masuk ke akun Anda untuk melanjutkan.
                            </p>

                            {flashError && (
                                <div
                                    className="login-alert login-alert-error"
                                    role="alert"
                                >
                                    {flashError}
                                </div>
                            )}
                            {status && (
                                <div
                                    className="login-alert login-alert-success"
                                    role="status"
                                >
                                    {status}
                                </div>
                            )}

                            <form
                                onSubmit={submit}
                                className="login-form"
                                aria-busy={processing}
                            >
                                {/* Database */}
                                <div className="login-field">
                                    <label htmlFor="database">
                                        Perusahaan <span>/ Database</span>
                                    </label>
                                    <div className="login-control">
                                        <Building2
                                            className="login-field-icon"
                                            size={18}
                                            aria-hidden="true"
                                        />
                                        <select
                                            id="database"
                                            name="database"
                                            required
                                            value={data.database}
                                            onChange={(event) =>
                                                setData(
                                                    'database',
                                                    event.target.value,
                                                )
                                            }
                                            disabled={processing}
                                            data-empty={!data.database}
                                            aria-invalid={Boolean(databaseError)}
                                            aria-describedby={
                                                databaseError
                                                    ? 'database-error'
                                                    : undefined
                                            }
                                        >
                                            <option value="" disabled>
                                                Pilih perusahaan Anda
                                            </option>
                                            {databases.map((database) => (
                                                <option
                                                    key={database}
                                                    value={database}
                                                >
                                                    {databaseLabels[database] ||
                                                        database}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown
                                            className="login-select-icon"
                                            size={16}
                                            aria-hidden="true"
                                        />
                                    </div>
                                    {databaseError && (
                                        <p
                                            className="login-field-error"
                                            id="database-error"
                                            role="alert"
                                        >
                                            {databaseError}
                                        </p>
                                    )}
                                </div>

                                {/* Username */}
                                <div className="login-field">
                                    <label htmlFor="pengguna">Username</label>
                                    <div className="login-control">
                                        <UserRound
                                            className="login-field-icon"
                                            size={18}
                                            aria-hidden="true"
                                        />
                                        <input
                                            id="pengguna"
                                            type="text"
                                            name="pengguna"
                                            value={data.pengguna}
                                            onChange={(event) =>
                                                setData(
                                                    'pengguna',
                                                    event.target.value,
                                                )
                                            }
                                            required
                                            autoComplete="username"
                                            autoCapitalize="none"
                                            autoCorrect="off"
                                            spellCheck={false}
                                            placeholder="Masukkan username"
                                            disabled={processing}
                                            aria-invalid={Boolean(usernameError)}
                                            aria-describedby={
                                                usernameError
                                                    ? 'username-error'
                                                    : undefined
                                            }
                                        />
                                    </div>
                                    {usernameError && (
                                        <p
                                            className="login-field-error"
                                            id="username-error"
                                            role="alert"
                                        >
                                            {usernameError}
                                        </p>
                                    )}
                                </div>

                                {/* Password */}
                                <div className="login-field">
                                    <label htmlFor="password">Password</label>
                                    <div className="login-control">
                                        <KeyRound
                                            className="login-field-icon"
                                            size={18}
                                            aria-hidden="true"
                                        />
                                        <input
                                            id="password"
                                            type={
                                                showPassword
                                                    ? 'text'
                                                    : 'password'
                                            }
                                            name="password"
                                            value={data.password}
                                            onChange={(event) =>
                                                setData(
                                                    'password',
                                                    event.target.value,
                                                )
                                            }
                                            onKeyUp={(event) =>
                                                setCapsLock(
                                                    event.getModifierState(
                                                        'CapsLock',
                                                    ),
                                                )
                                            }
                                            onKeyDown={(event) =>
                                                setCapsLock(
                                                    event.getModifierState(
                                                        'CapsLock',
                                                    ),
                                                )
                                            }
                                            onBlur={() => setCapsLock(false)}
                                            required
                                            autoComplete="current-password"
                                            placeholder="Masukkan password"
                                            disabled={processing}
                                            aria-invalid={Boolean(passwordError)}
                                            aria-describedby={
                                                passwordError
                                                    ? 'password-error'
                                                    : capsLock
                                                      ? 'caps-lock-hint'
                                                      : undefined
                                            }
                                        />
                                        <button
                                            className="login-password-toggle"
                                            type="button"
                                            onClick={() =>
                                                setShowPassword(
                                                    (visible) => !visible,
                                                )
                                            }
                                            aria-label={
                                                showPassword
                                                    ? 'Sembunyikan password'
                                                    : 'Tampilkan password'
                                            }
                                            aria-pressed={showPassword}
                                            aria-controls="password"
                                            disabled={processing}
                                        >
                                            {showPassword ? (
                                                <EyeOff
                                                    size={17}
                                                    aria-hidden="true"
                                                />
                                            ) : (
                                                <Eye
                                                    size={17}
                                                    aria-hidden="true"
                                                />
                                            )}
                                        </button>
                                    </div>
                                    {passwordError && (
                                        <p
                                            className="login-field-error"
                                            id="password-error"
                                            role="alert"
                                        >
                                            {passwordError}
                                        </p>
                                    )}
                                    {capsLock && (
                                        <p
                                            className="login-caps-hint"
                                            id="caps-lock-hint"
                                            role="status"
                                        >
                                            ⚠ Caps Lock sedang aktif.
                                        </p>
                                    )}
                                </div>

                                {/* Submit */}
                                <button
                                    className="login-submit"
                                    type="submit"
                                    disabled={processing}
                                    data-test="login-button"
                                >
                                    <span>
                                        {processing
                                            ? 'Sedang masuk...'
                                            : 'Masuk ke workspace'}
                                    </span>
                                    {processing ? (
                                        <span
                                            className="login-loading-spinner"
                                            aria-hidden="true"
                                        />
                                    ) : (
                                        <ArrowRight
                                            size={17}
                                            aria-hidden="true"
                                        />
                                    )}
                                </button>
                            </form>

                            {/* Security note */}
                            <div className="login-access-help">
                                <ShieldCheck size={16} aria-hidden="true" />
                                <p>
                                    Gunakan akun yang telah diberikan
                                    <br />
                                    oleh administrator perusahaan Anda.
                                </p>
                            </div>

                            <IntentionNote compact />
                        </div>
                    </section>
                </main>

                {/* ── Footer ───────────────────────────────────────────── */}
                <footer className="login-footer">
                    <span>© {new Date().getFullYear()} i-System</span>
                    <span>Dibangun untuk pekerjaan yang berarti.</span>
                </footer>
            </div>
        </>
    );
}
