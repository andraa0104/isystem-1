<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" @class(['dark' => ($appearance ?? 'system') == 'dark'])>
    <head>
        <meta charset="utf-8">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        {{-- Inline script to detect system dark mode preference and apply it immediately --}}
        <script>
            (function() {
                const appearance = '{{ $appearance ?? "system" }}';

                if (appearance === 'system') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

                    if (prefersDark) {
                        document.documentElement.classList.add('dark');
                    }
                }
            })();
        </script>

        {{-- Inline style to set the HTML background color based on our theme in app.css --}}
        <style>
            html {
                background-color: #ffffff;
                background-color: oklch(1 0 0);
            }

            html.dark {
                background-color: #121212;
                background-color: oklch(0.145 0 0);
            }

            /* Cross-OS & Legacy Browser (Windows 7/8, Chrome <= 109) Compatibility Fallbacks */
            /* Tabler / Ant Design Enterprise Layout & Border Solid Fallbacks */
            :root {
                --sidebar-border: #e2e8f0;
                --border: #e2e8f0;
            }
            .dark {
                --sidebar-border: #27272a;
                --border: #27272a;
            }

            /* Solid borders across all content borders & sidebar */
            [class*="border-sidebar-border"],
            .border-sidebar-border,
            .border-border,
            [class~="border-border"] {
                border-color: #e2e8f0 !important;
            }
            .dark [class*="border-sidebar-border"],
            .dark .border-sidebar-border,
            .dark .border-border,
            .dark [class~="border-border"] {
                border-color: #27272a !important;
            }

            /* Header border */
            header[class*="border-b"],
            [data-slot="sidebar-inset"] > header {
                border-bottom: 1px solid #e2e8f0 !important;
            }
            .dark header[class*="border-b"],
            .dark [data-slot="sidebar-inset"] > header {
                border-bottom: 1px solid #27272a !important;
            }

            /* Main Layout Content Area - Enterprise Canvas Background */
            [data-slot="sidebar-inset"] {
                min-height: 100vh !important;
                background-color: #f8fafc;
            }
            .dark [data-slot="sidebar-inset"] {
                background-color: #09090b;
            }

            /* Solid Color Fallbacks for Older Browsers without OKLCH support (Chrome <= 110, Windows 7) */
            .bg-emerald-600,
            [class~="bg-emerald-600"] {
                background-color: #059669 !important;
            }
            .hover\:bg-emerald-700:hover,
            [class*="hover:bg-emerald-700"]:hover {
                background-color: #047857 !important;
            }
            .bg-emerald-700,
            [class~="bg-emerald-700"] {
                background-color: #047857 !important;
            }
            .text-emerald-600,
            [class~="text-emerald-600"] {
                color: #059669 !important;
            }
            .text-emerald-700,
            [class~="text-emerald-700"] {
                color: #047857 !important;
            }
            .border-emerald-600,
            [class~="border-emerald-600"] {
                border-color: #059669 !important;
            }
        </style>

        <title inertia>{{ config('app.name', 'Laravel') }}</title>

        <link rel="icon" href="/favicon.ico" sizes="any">
        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">

        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600" rel="stylesheet" />

        @viteReactRefresh
        @vite(['resources/js/app.jsx', "resources/js/pages/{$page['component']}.jsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
