<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tb_cspic', function (Blueprint $table) {
            $table->id();
            $table->string('kd_cs', 255);
            $table->string('customer_name', 255);
            $table->string('pic_name', 255);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tb_cspic');
    }
};
