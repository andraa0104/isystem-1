<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$d = DB::table('tb_detailpoin')->where('sisa_qtydo', '>', 0)->first();
if ($d) {
    print_r($d);
    $p = DB::table('tb_poin')->where('kode_poin', $d->kode_poin)->first();
    print_r($p);
} else {
    echo "No DO Outstanding found.";
}
