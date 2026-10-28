<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;

class PurchaseOrderInChanged implements ShouldBroadcastNow, ShouldDispatchAfterCommit
{
    public function __construct(private string $channel) {}

    public static function channelForDatabase(string $database): string
    {
        return 'purchase-order-in.'.hash('sha256', $database);
    }

    public static function currentChannel(): string
    {
        $connection = config('database.default');

        return static::channelForDatabase((string) config("database.connections.$connection.database"));
    }

    public function broadcastOn(): array
    {
        return [new PrivateChannel($this->channel)];
    }

    public function broadcastAs(): string
    {
        return 'purchase-order-in.changed';
    }

    public function broadcastWith(): array
    {
        // Clients re-fetch through the existing authorized data endpoints.
        return [];
    }
}
