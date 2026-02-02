<?php

namespace App\Http\Controllers\Pembayaran;

use Inertia\Inertia;

class PaymentCostController
{
    public function index()
    {
        return Inertia::render('Pembayaran/payment-cost/index');
    }
}

