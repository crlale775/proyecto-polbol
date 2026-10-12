<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Catálogo de TIPOS DE MEMORÁNDUM con su formato y reglas de validación.
 *
 * Cada registro describe el "patrón" institucional de un tipo de memorándum:
 *   · formato      → secciones y campos que debe contener (JSON).
 *   · validaciones → reglas que el sistema exige al emitirlo (JSON).
 *
 * Se vincula opcionalmente a tipos_documento (id_tipo) para poder medir su uso
 * real sobre los documentos ya registrados.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tipos_memo', function (Blueprint $table) {
            $table->id('id_memo');
            $table->unsignedInteger('id_tipo')->nullable()->unique();
            $table->string('nombre', 120)->unique();
            $table->string('codigo', 30)->unique();
            $table->string('categoria', 60)->nullable();
            $table->text('descripcion')->nullable();
            $table->jsonb('formato')->nullable();
            $table->jsonb('validaciones')->nullable();
            $table->string('color', 20)->default('#3d4a2c');
            $table->boolean('activo')->default(true);
            $table->unsignedInteger('creado_por')->nullable();
            $table->timestamps();

            $table->foreign('id_tipo')
                ->references('id_tipo')->on('tipos_documento')
                ->nullOnDelete();

            $table->foreign('creado_por')
                ->references('id_usuario')->on('usuarios')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tipos_memo');
    }
};
