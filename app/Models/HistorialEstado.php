<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HistorialEstado extends Model
{
    protected $table = 'historial_estados';
    protected $primaryKey = 'id_historial';
    public $timestamps = false;

    protected $fillable = [
        'id_documento',
        'estado_anterior',
        'estado_nuevo',
        'usuario',
        'fecha',
    ];

    protected $casts = [
        'id_documento' => 'integer',
        'estado_anterior' => 'integer',
        'estado_nuevo' => 'integer',
        'usuario' => 'integer',
        'fecha' => 'datetime',
    ];

    public function documento(): BelongsTo
    {
        return $this->belongsTo(Documento::class, 'id_documento', 'id_documento');
    }

    public function estadoAnterior(): BelongsTo
    {
        return $this->belongsTo(EstadoDocumento::class, 'estado_anterior', 'id_estado');
    }

    public function estadoNuevo(): BelongsTo
    {
        return $this->belongsTo(EstadoDocumento::class, 'estado_nuevo', 'id_estado');
    }

    public function usuarioRelacion(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'usuario', 'id_usuario');
    }

    // Alias convencional usado por DocumentoController (trazabilidad/show)
    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'usuario', 'id_usuario');
    }
}
