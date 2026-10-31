import { dashboard, login, register } from '@/routes/index';
import { Head, Link, usePage } from '@inertiajs/react';

export default function Welcome({
    canRegister = true,
    laravelVersion = '13',
    phpVersion = '8.4',
}) {
    const { auth } = usePage().props;
    const majorVersion = laravelVersion.split('.')[0];

    return (
        <>
            <Head title={`Laravel ${majorVersion}`}>
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link
                    href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600,700"
                    rel="stylesheet"
                />
            </Head>

            <div className="min-h-screen bg-[#f8f8f6] px-6 py-8 font-sans text-[#1b1b18] dark:bg-[#0a0a0a] dark:text-[#ededec] lg:px-8">
                <header className="mx-auto flex w-full max-w-5xl items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f53003] text-sm font-bold text-white">
                            L{majorVersion}
                        </span>
                        <span className="font-semibold">Laravel {majorVersion}</span>
                    </div>

                    <nav className="flex items-center gap-2 text-sm">
                        {auth?.user ? (
                            <Link
                                href={dashboard()}
                                className="rounded-lg bg-[#1b1b18] px-5 py-2.5 font-medium text-white transition hover:bg-black dark:bg-[#ededec] dark:text-[#1b1b18] dark:hover:bg-white"
                            >
                                Dashboard
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href={login()}
                                    className="rounded-lg px-5 py-2.5 font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
                                >
                                    Log in
                                </Link>
                                {canRegister && (
                                    <Link
                                        href={register()}
                                        className="rounded-lg border border-black/15 px-5 py-2.5 font-medium transition hover:border-black/30 dark:border-white/20 dark:hover:border-white/40"
                                    >
                                        Register
                                    </Link>
                                )}
                            </>
                        )}
                    </nav>
                </header>

                <main className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-5xl items-center py-12">
                    <section className="grid w-full overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-[#161615] lg:grid-cols-[1.1fr_0.9fr]">
                        <div className="flex flex-col justify-center p-8 sm:p-12 lg:p-16">
                            <div className="mb-6 flex flex-wrap gap-2 text-xs font-medium">
                                <span className="rounded-full bg-[#fff0ed] px-3 py-1.5 text-[#d92d0b] dark:bg-[#f53003]/15 dark:text-[#ff6b4a]">
                                    Laravel {laravelVersion}
                                </span>
                                <span className="rounded-full bg-black/5 px-3 py-1.5 text-black/60 dark:bg-white/10 dark:text-white/65">
                                    PHP {phpVersion}
                                </span>
                            </div>

                            <h1 className="max-w-xl text-4xl leading-tight font-semibold tracking-[-0.03em] sm:text-5xl">
                                Aplikasi telah berjalan di Laravel {majorVersion}.
                            </h1>
                            <p className="mt-5 max-w-lg text-base leading-7 text-black/60 dark:text-white/60">
                                Framework dan dependensi telah diperbarui, sementara alur bisnis serta aturan aplikasi tetap dipertahankan.
                            </p>

                            <div className="mt-8 flex flex-wrap gap-3">
                                <Link
                                    href={auth?.user ? dashboard() : login()}
                                    className="rounded-lg bg-[#f53003] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#d92d0b]"
                                >
                                    {auth?.user ? 'Buka dashboard' : 'Masuk ke aplikasi'}
                                </Link>
                                <a
                                    href="https://laravel.com/docs/13.x"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-lg border border-black/15 px-5 py-3 text-sm font-semibold transition hover:border-black/30 dark:border-white/20 dark:hover:border-white/40"
                                >
                                    Dokumentasi Laravel 13
                                </a>
                            </div>
                        </div>

                        <div className="relative flex min-h-80 items-center justify-center overflow-hidden bg-[#fff0ed] p-10 dark:bg-[#260803]">
                            <div className="absolute -top-24 -right-20 h-72 w-72 rounded-full bg-[#f53003]/20 blur-3xl" />
                            <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-[#ffb4a2]/40 blur-3xl dark:bg-[#f53003]/15" />
                            <div className="relative text-center">
                                <div className="text-[11rem] leading-none font-bold tracking-[-0.1em] text-[#f53003] sm:text-[13rem]">
                                    {majorVersion}
                                </div>
                                <div className="mt-2 text-sm font-semibold tracking-[0.35em] text-[#d92d0b] uppercase dark:text-[#ff8066]">
                                    Laravel
                                </div>
                            </div>
                        </div>
                    </section>
                </main>
            </div>
        </>
    );
}
