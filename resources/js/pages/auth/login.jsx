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
} from 'lucide-react';
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
                <Sparkles size={14} aria-hidden="true" />
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

function WorkspaceVisual() {
    return (
        <div className="login-visual" aria-hidden="true">
            <svg
                className="login-connections"
                viewBox="0 0 480 184"
                fill="none"
            >
                <path
                    d="M240 62V88M240 88H77V128M240 88V128M240 88H403V128"
                    stroke="#467082"
                    strokeWidth="1.5"
                />
                <path
                    d="M77 118V128M240 118V128M403 118V128"
                    stroke="#8ce4c4"
                    strokeWidth="2"
                />
                <circle cx="240" cy="88" r="4" fill="#8ce4c4" />
            </svg>
            <div className="login-flow-hub">
                <Layers3 size={20} />
                <span>i-System</span>
                <span className="login-flow-dot" />
            </div>
            <div className="login-flow-modules">
                <div>
                    <TrendingUp size={17} />
                    <span>Penjualan</span>
                </div>
                <div>
                    <Package size={17} />
                    <span>Persediaan</span>
                </div>
                <div>
                    <Wallet size={17} />
                    <span>Keuangan</span>
                </div>
            </div>
            <p className="login-visual-caption">SATU ALUR. SEMUA TERHUBUNG.</p>
        </div>
    );
}

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
            <div className="login-page">
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
                    <span className="login-topbar-note">
                        Ruang kerja. Lebih terarah.
                    </span>
                </header>

                <main className="login-workspace">
                    <section
                        className="login-story"
                        aria-label="Selamat datang di i-System"
                    >
                        <div className="login-story-heading">
                            <div className="login-eyebrow">
                                <span className="login-eyebrow-line" /> RUANG
                                KERJA TERINTEGRASI
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

                    <section
                        className="login-access"
                        aria-labelledby="login-title"
                    >
                        <div className="login-form-container">
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
                                            aria-invalid={Boolean(
                                                databaseError,
                                            )}
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
                                            aria-invalid={Boolean(
                                                usernameError,
                                            )}
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
                                            aria-invalid={Boolean(
                                                passwordError,
                                            )}
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
                                                    size={18}
                                                    aria-hidden="true"
                                                />
                                            ) : (
                                                <Eye
                                                    size={18}
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
                                            Caps Lock sedang aktif.
                                        </p>
                                    )}
                                </div>

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
                                            size={18}
                                            aria-hidden="true"
                                        />
                                    )}
                                </button>
                            </form>

                            <div className="login-access-help">
                                <ShieldCheck size={17} aria-hidden="true" />
                                <p>
                                    Gunakan akun yang telah diberikan
                                    <br className="login-help-break" /> oleh
                                    administrator perusahaan Anda.
                                </p>
                            </div>
                            <IntentionNote compact />
                        </div>
                    </section>
                </main>

                <footer className="login-footer">
                    <span>© {new Date().getFullYear()} i-System</span>
                    <span>Dibangun untuk pekerjaan yang berarti.</span>
                </footer>
            </div>
        </>
    );
}
