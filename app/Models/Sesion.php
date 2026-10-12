<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Sesion extends Model
{
    protected $table = 'sesiones';
    protected $primaryKey = 'id_sesion';
    public $timestamps = false;

    protected $fillable = [
        'id_usuario',
        'ip',
        'fecha_inicio',
        'fecha_fin',
    ];

    protected $casts = [
        'id_usuario' => 'integer',
        'fecha_inicio' => 'datetime',
        'fecha_fin' => 'datetime',
    ];

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'id_usuario', 'id_usuario');
    }
}
