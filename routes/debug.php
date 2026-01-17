<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use App\Models\Pengguna;

Route::get('/debug-login', function (Request $request) {
    if (app()->environment('production')) {
        abort(404);
    }
    
    $database = $request->input('database', 'dbsja');
    $username = $request->input('pengguna', 'admin');
    $password = $request->input('password', 'password');
    
    // Switch DB similar to middleware logic
    $allowed = config('tenants.databases', []);
    if ($database && in_array($database, $allowed, true)) {
        $connection = config('tenants.connection', config('database.default'));
        config(["database.connections.$connection.database" => $database]);
        DB::purge($connection);
        DB::reconnect($connection);
    } else {
        return ['error' => "Database $database not allowed. Allowed: " . implode(', ', $allowed)];
    }
    
    $user = Pengguna::where('pengguna', $username)->first();
    
    $result = [
        'database_selected' => $database,
        'connection_config_database' => config("database.connections.$connection.database"),
        'username_input' => $username,
        'password_input' => $password,
        'user_found' => $user ? 'YES' : 'NO',
    ];
    
    if ($user) {
        $result['user_attributes'] = $user->toArray();
        $result['stored_password_hash'] = $user->pass;
        $result['auth_password_method_returns'] = $user->getAuthPassword();
        $result['is_legacy_md5'] = strlen($user->pass) === 32;
        $result['hash_check_bcrypt'] = Hash::check($password, $user->pass) ? 'PASS' : 'FAIL';
        $result['hash_check_md5'] = (md5($password) === $user->pass) ? 'PASS' : 'FAIL';
        
        // Manual Auth Attempt
        $attempt = Auth::attempt(['pengguna' => $username, 'password' => $password]);
        $result['auth_attempt_result'] = $attempt ? 'SUCCESS' : 'FAIL';
        
        if ($attempt) {
            $result['session_user_id'] = Auth::id();
            $result['session_after_auth'] = session()->all();
        }
    }
    
    return $result;
});
