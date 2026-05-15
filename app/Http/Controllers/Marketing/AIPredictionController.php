<?php

namespace App\Http\Controllers\Marketing;

use App\Http\Controllers\Controller;
use App\Services\AIPredictionService;
use Illuminate\Http\Request;

class AIPredictionController extends Controller
{
    protected $aiService;

    public function __construct(AIPredictionService $aiService)
    {
        $this->aiService = $aiService;
    }

    /**
     * Get AI-based predictions for PO In fields.
     */
    public function predictPOIn(Request $request)
    {
        $request->validate([
            'customer_name' => 'required|string',
        ]);

        $customerName = $request->input('customer_name');
        $prediction = $this->aiService->predictPOInFields($customerName);

        return response()->json($prediction);
    }

    public function clusterRemarks(Request $request)
    {
        $request->validate([
            'remarks' => 'required|array',
        ]);

        $remarks = $request->input('remarks');
        $prediction = $this->aiService->clusterRemarks($remarks);

        return response()->json($prediction);
    }
}
