<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Modelo alineado a la estructura REAL de la tabla plantillas:
 * id_plantilla, nombre, tipo_documento, ruta_archivo
 */
class Plantilla extends Model
{
    protected $table = 'plantillas';
    protected $primaryKey = 'id_plantilla';
    public $timestamps = false;

    protected $fillable = [
        'nombre',
        'tipo_documento',
        'ruta_archivo',
    ];

    protected $casts = [
        'tipo_documento' => 'integer',
    ];

    public function tipoDocumento(): BelongsTo
    {
        return $this->belongsTo(TipoDocumento::class, 'tipo_documento', 'id_tipo');
    }
}
