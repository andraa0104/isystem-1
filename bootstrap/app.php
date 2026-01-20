<?php

use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SetTenantDatabase;
use App\Http\Middleware\AuthenticateFromCookie;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Inertia\Inertia;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->trustProxies(at: '*');
        
        // DISABLE ALL COOKIE ENCRYPTION - NO SECURITY
        $middleware->encryptCookies(except: ['*']);
        
        // DISABLE ALL CSRF PROTECTION - NO SECURITY  
        $middleware->validateCsrfTokens(except: ['*']);

        $middleware->web(append: [
            SetTenantDatabase::class,
            AuthenticateFromCookie::class,
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (AuthenticationException $exception, Request $request) {
            if ($request->header('X-Inertia')) {
                return Inertia::location(route('login'));
            }
        });
    })->create();
