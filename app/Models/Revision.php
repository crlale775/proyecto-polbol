<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Revision extends Model
{
    protected $table = 'revisiones';
    protected $primaryKey = 'id_revision';
    public $timestamps = false;

    protected $fillable = [
        'id_documento',
        'usuario_revisor',
        'id_tipo_observacion',
        'nivel_revision',
        'estado',
        'observacion_libre',
        'fecha',
    ];

    protected $casts = [
        'id_documento' => 'integer',
        'usuario_revisor' => 'integer',
        'id_tipo_observacion' => 'integer',
        'fecha' => 'datetime',
    ];

    public function documento(): BelongsTo
    {
        return $this->belongsTo(Documento::class, 'id_documento', 'id_documento');
    }

    public function revisor(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'usuario_revisor', 'id_usuario');
    }

    public function tipoObservacion(): BelongsTo
    {
        return $this->belongsTo(TipoObservacion::class, 'id_tipo_observacion', 'id_tipo');
    }
}
