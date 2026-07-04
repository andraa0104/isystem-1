<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
try {
    $r = DB::table('tb_poin')->select('status')->limit(1)->get();
    echo "Has status column";
} catch (\Exception $e) {
    echo "No status column: " . $e->getMessage();
}
