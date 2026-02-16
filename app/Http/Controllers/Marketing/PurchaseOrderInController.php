<?php

namespace App\Http\Controllers\Marketing;

use Inertia\Inertia;

class PurchaseOrderInController
{
    public function index()
    {
        return Inertia::render('marketing/purchase-order-in/index', [
            'summary' => [
                'total' => 26,
                'waitingApproval' => 4,
                'readyToProcess' => 15,
                'needRevision' => 2,
            ],
            'purchaseOrderIns' => [
                [
                    'no_poin' => 'POIN-2026-0012',
                    'date' => '2026-02-14',
                    'vendor' => 'PT Sinar Karya Utama',
                    'ref_po' => 'PO-2026-0045',
                    'status' => 'Ready',
                    'grand_total' => 125000000,
                ],
                [
                    'no_poin' => 'POIN-2026-0011',
                    'date' => '2026-02-13',
                    'vendor' => 'CV Bintang Niaga',
                    'ref_po' => 'PO-2026-0044',
                    'status' => 'Waiting Approval',
                    'grand_total' => 49800000,
                ],
                [
                    'no_poin' => 'POIN-2026-0010',
                    'date' => '2026-02-12',
                    'vendor' => 'PT Cakra Persada',
                    'ref_po' => 'PO-2026-0042',
                    'status' => 'Revision',
                    'grand_total' => 27500000,
                ],
            ],
        ]);
    }

    public function create()
    {
        return Inertia::render('marketing/purchase-order-in/create', [
            'defaults' => [
                'date' => now()->toDateString(),
                'payment_term' => '30 Hari',
                'currency' => 'IDR',
            ],
            'vendors' => [
                'PT Sinar Karya Utama',
                'CV Bintang Niaga',
                'PT Cakra Persada',
            ],
        ]);
    }
}
