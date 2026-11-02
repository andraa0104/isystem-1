<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Broadcasting\ShouldRescue;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Support\Facades\DB;

class PurchaseRequirementChanged implements ShouldBroadcastNow, ShouldDispatchAfterCommit, ShouldRescue
{
    public function __construct(private readonly string $channel) {}

    public static function channelForDatabase(string $database): string
    {
        return 'purchase-requirement.'.hash('sha256', $database);
    }

    public static function currentChannel(): string
    {
        return static::channelForDatabase((string) DB::connection()->getDatabaseName());
    }

    public function broadcastOn(): array
    {
        return [new PrivateChannel($this->channel)];
    }

    public function broadcastAs(): string
    {
        return 'purchase-requirement.changed';
    }

    public function broadcastWith(): array
    {
        // Clients re-fetch through the existing authorized data endpoints.
        return [];
    }
}
