<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Notificacion extends Model
{
    protected $table = 'notificaciones';
    protected $primaryKey = 'id_notificacion';
    public $timestamps = false;

    protected $fillable = [
        'id_usuario',
        'id_documento',
        'titulo',
        'mensaje',
        'leido',
        'fecha',
    ];

    protected $casts = [
        'id_usuario' => 'integer',
        'id_documento' => 'integer',
        'leido' => 'boolean',
        'fecha' => 'datetime',
    ];

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'id_usuario', 'id_usuario');
    }

    public function documento(): BelongsTo
    {
        return $this->belongsTo(Documento::class, 'id_documento', 'id_documento');
    }
}
