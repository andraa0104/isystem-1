<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MasterDataRowsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:200'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', Rule::in([5, 10, 15, 25, 50, 100, 'all'])],
            'order' => ['nullable', Rule::in(['asc', 'desc'])],
            'stock' => ['nullable', Rule::in(['all', 'top', 'low', 'empty'])],
        ];
    }
}
