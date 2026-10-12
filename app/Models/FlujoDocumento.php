<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Modelo alineado a la estructura REAL de la tabla flujo_documentos:
 * id_flujo, id_documento, origen (varchar), destino (varchar), usuario, fecha
 */
class FlujoDocumento extends Model
{
    protected $table = 'flujo_documentos';
    protected $primaryKey = 'id_flujo';
    public $timestamps = false;

    protected $fillable = [
        'id_documento',
        'origen',
        'destino',
        'usuario',
        'fecha',
    ];

    protected $casts = [
        'id_documento' => 'integer',
        'usuario' => 'integer',
        'fecha' => 'datetime',
    ];

    public function documento(): BelongsTo
    {
        return $this->belongsTo(Documento::class, 'id_documento', 'id_documento');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'usuario', 'id_usuario');
    }

    public function usuarioRelacion(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'usuario', 'id_usuario');
    }
}
