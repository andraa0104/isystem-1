<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;

class Pengguna extends Authenticatable
{
    protected $table = 'tb_pengguna';

    protected $primaryKey = 'pengguna';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    protected $hidden = [
        'pass',
    ];

    protected $appends = [
        'name',
        'last_online',
    ];

    public function getConnectionName()
    {
        $connection = config('tenants.connection', $this->connection);
        $allowed = config('tenants.databases', []);
        $request = request();
        $database = $request?->session()->get('tenant.database')
            ?? $request?->cookie('tenant_database');

        if ($database && in_array($database, $allowed, true)) {
            config(["database.connections.$connection.database" => $database]);
        }

        return $connection;
    }

    public function getNameAttribute(): string
    {
        return (string) ($this->attributes['nm_user'] ?? $this->pengguna);
    }

    public function getLastOnlineAttribute(): ?string
    {
        return $this->attributes['LastOnline']
            ?? $this->attributes['last_online']
            ?? null;
    }

    public function getEmailAttribute(): ?string
    {
        return $this->attributes['email'] ?? null;
    }
    public function getAuthPassword()
    {
        return $this->pass;
    }

    public function getAuthIdentifierName()
    {
        return 'pengguna';
    }

    /**
     * Disable remember token for legacy database.
     */
    public function getRememberToken()
    {
        return null;
    }

    public function setRememberToken($value)
    {
        // Do nothing
    }

    public function getRememberTokenName()
    {
        return null; // Disable remember token column lookup
    }
}
