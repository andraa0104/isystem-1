<?php

use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SetTenantDatabase;
use App\Http\Middleware\AuthenticateFromCookie;
use App\Http\Middleware\EnsureAdminTingkat;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\QueryException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Inertia\Inertia;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

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

        $middleware->alias([
            'admin.tingkat' => EnsureAdminTingkat::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (AuthenticationException $exception, Request $request) {
            if ($request->header('X-Inertia')) {
                return Inertia::location(route('login'));
            }
        });

        $exceptions->render(function (Throwable $exception, Request $request) {
            if (!$request->expectsJson()) {
                return null;
            }

            if ($exception instanceof \Illuminate\Validation\ValidationException) {
                return null;
            }

            $status = 500;
            if ($exception instanceof HttpExceptionInterface) {
                $status = $exception->getStatusCode();
            } elseif ($exception instanceof ModelNotFoundException) {
                $status = 404;
            }

            $payload = [
                'message' => $exception->getMessage() ?: 'Server error',
                'exception' => get_class($exception),
                'status' => $status,
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
            ];

            if ($exception instanceof QueryException) {
                $errorInfo = $exception->errorInfo ?? [];
                $payload['sql_state'] = $errorInfo[0] ?? null;
                $payload['driver_code'] = $errorInfo[1] ?? null;
                $payload['driver_message'] = $errorInfo[2] ?? null;
                $payload['sql'] = $exception->getSql();
                $payload['bindings'] = $exception->getBindings();
            }

            $traceLines = array_slice(
                preg_split("/\\r\\n|\\r|\\n/", $exception->getTraceAsString()) ?: [],
                0,
                15
            );
            if (count($traceLines) > 0) {
                $payload['trace'] = implode("\n", $traceLines);
            }

            return response()->json($payload, $status);
        });
    })->create();
