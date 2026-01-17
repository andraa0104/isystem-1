<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;

Route::get('/debug-session-set', function (Request $request) {
    $request->session()->put('debug_test', 'Session is working: ' . now());
    return 'Session value set. Go to <a href="/debug-session-get">/debug-session-get</a>';
});

Route::get('/debug-session-get', function (Request $request) {
    if ($request->session()->has('debug_test')) {
        return 'Session Value: ' . $request->session()->get('debug_test') . '<br>Session ID: ' . $request->session()->getId();
    }
    return 'Session Value MISSING. Session ID: ' . $request->session()->getId();
});
