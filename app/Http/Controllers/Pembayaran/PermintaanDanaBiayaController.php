<?php

namespace App\Http\Controllers\Pembayaran;

use Inertia\Inertia;

class PermintaanDanaBiayaController
{
    public function index()
    {
        return Inertia::render('Pembayaran/permintaan-dana-biaya/index');
    }
}

