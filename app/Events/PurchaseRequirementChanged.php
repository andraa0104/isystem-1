<?php

namespace App\Events;

class PurchaseRequirementChanged extends PurchaseOrderInChanged
{
    public static function channelForDatabase(string $database): string
    {
        return 'purchase-requirement.'.hash('sha256', $database);
    }

    public function broadcastAs(): string
    {
        return 'purchase-requirement.changed';
    }
}
