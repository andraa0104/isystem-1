<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Broadcasting\ShouldRescue;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Support\Facades\DB;

class QuotationChanged implements ShouldBroadcastNow, ShouldDispatchAfterCommit, ShouldRescue
{
    public function __construct(private readonly string $channel) {}

    public static function channelForDatabase(string $database): string
    {
        return 'quotation.'.hash('sha256', $database);
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
        return 'quotation.changed';
    }

    public function broadcastWith(): array
    {
        // Fetch current rows through the existing authorized endpoints.
        return [];
    }
}
