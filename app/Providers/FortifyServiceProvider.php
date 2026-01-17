<?php

namespace App\Providers;

use App\Actions\Fortify\CreateNewUser;
use App\Actions\Fortify\ResetUserPassword;
use App\Models\Pengguna;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Cookie;
use Inertia\Inertia;
use Laravel\Fortify\Features;
use Laravel\Fortify\Fortify;

class FortifyServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        \Illuminate\Support\Facades\Log::info('FortifyServiceProvider booting...');
        $this->configureActions();
        $this->configureAuthentication();
        $this->configureViews();
        $this->configureRateLimiting();
    }

    /**
     * Configure Fortify actions.
     */
    private function configureActions(): void
    {
        Fortify::resetUserPasswordsUsing(ResetUserPassword::class);
        Fortify::createUsersUsing(CreateNewUser::class);
    }

    /**
     * Configure Fortify views.
     */
    private function configureViews(): void
    {
        Fortify::loginView(fn (Request $request) => Inertia::render('auth/login', [
            'canResetPassword' => Features::enabled(Features::resetPasswords()),
            'canRegister' => Features::enabled(Features::registration()),
            'status' => $request->session()->get('status'),
            'databases' => config('tenants.databases', []),
            'selectedDatabase' => $request->session()->get('tenant.database'),
        ]));

        Fortify::resetPasswordView(fn (Request $request) => Inertia::render('auth/reset-password', [
            'email' => $request->email,
            'token' => $request->route('token'),
        ]));

        Fortify::requestPasswordResetLinkView(fn (Request $request) => Inertia::render('auth/forgot-password', [
            'status' => $request->session()->get('status'),
        ]));

        Fortify::verifyEmailView(fn (Request $request) => Inertia::render('auth/verify-email', [
            'status' => $request->session()->get('status'),
        ]));

        Fortify::registerView(fn () => Inertia::render('auth/register'));

        Fortify::twoFactorChallengeView(fn () => Inertia::render('auth/two-factor-challenge'));

        Fortify::confirmPasswordView(fn () => Inertia::render('auth/confirm-password'));
    }

    /**
     * Configure Fortify authentication for tenant databases.
     */
    private function configureAuthentication(): void
    {
        Fortify::authenticateUsing(function (Request $request) {
            $allowed = config('tenants.databases', []);
            $database = $request->input('database');

            if (!$database || !in_array($database, $allowed, true)) {
                throw ValidationException::withMessages([
                    'database' => __('Please select a valid database.'),
                ]);
            }

            $request->session()->put('tenant.database', $database);
            Cookie::queue('tenant_database', $database, 60 * 24 * 30);
            $connection = config('tenants.connection', config('database.default'));
            config(['database.default' => $connection]);
            DB::setDefaultConnection($connection);
            config(["database.connections.$connection.database" => $database]);
            DB::purge($connection);
            DB::reconnect($connection);

            $username = $request->input('pengguna');
            $password = $request->input('password');

            $user = Pengguna::on($connection)
                ->where('pengguna', $username)
                ->first();

            if ($user) {
                // User stated plaintext only.
                // Using trim to avoid char/varchar padding issues.
                if ((string) $password === trim($user->pass)) {
                    \Illuminate\Support\Facades\Log::info("Login success for user: {$user->pengguna} on DB: {$database}");
                    return $user;
                }
            }

            \Illuminate\Support\Facades\Log::warning("Login failed for username: $username on DB: $database. User found: " . ($user ? 'YES' : 'NO'));
            if ($user) {
                 \Illuminate\Support\Facades\Log::warning("Password mismatch. Input: $password. stored: " . $user->pass);
            }

            throw ValidationException::withMessages([
                'pengguna' => __('Username atau password salah.'),
            ]);
        });
    }

    /**
     * Configure rate limiting.
     */
    private function configureRateLimiting(): void
    {
        RateLimiter::for('two-factor', function (Request $request) {
            return Limit::perMinute(5)->by($request->session()->get('login.id'));
        });

        RateLimiter::for('login', function (Request $request) {
            $throttleKey = Str::transliterate(Str::lower($request->input(Fortify::username())).'|'.$request->ip());

            return Limit::perMinute(5)->by($throttleKey);
        });
    }
}
