<?php

use Illuminate\Support\Facades\Broadcast;
use App\Events\PurchaseOrderInChanged;
use App\Events\PurchaseRequirementChanged;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('purchase-order-in.{tenant}', function ($user, string $tenant) {
    return $user !== null && hash_equals(
        PurchaseOrderInChanged::currentChannel(),
        'purchase-order-in.'.$tenant,
    );
});

Broadcast::channel('purchase-requirement.{tenant}', function ($user, string $tenant) {
    return $user !== null && hash_equals(
        PurchaseRequirementChanged::currentChannel(),
        'purchase-requirement.'.$tenant,
    );
});
