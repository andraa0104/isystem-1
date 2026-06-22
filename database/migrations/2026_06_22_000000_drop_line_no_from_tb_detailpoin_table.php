<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('tb_detailpoin', 'line_no')) {
            Schema::table('tb_detailpoin', function (Blueprint $table) {
                $table->dropColumn('line_no');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('tb_detailpoin', 'line_no')) {
            Schema::table('tb_detailpoin', function (Blueprint $table) {
                $table->unsignedInteger('line_no')->nullable();
            });
        }
    }
};
