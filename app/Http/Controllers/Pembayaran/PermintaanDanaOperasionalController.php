<?php

namespace App\Http\Controllers\Pembayaran;

use Inertia\Inertia;

class PermintaanDanaOperasionalController
{
    public function index()
    {
        return Inertia::render('Pembayaran/permintaan-dana-operasional/index');
    }
}

