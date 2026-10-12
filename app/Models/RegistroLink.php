<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RegistroLink extends Model
{
    protected $table = 'links_registro';
    protected $primaryKey = 'id_link';
    public $timestamps = false;

    protected $fillable = [
        'token',
        'id_rol',
        'id_epi',
        'id_usuario_emisor',
        'estado',
        'fecha_expiracion',
        'creado_en',
    ];

    protected $casts = [
        'id_rol' => 'integer',
        'id_epi' => 'integer',
        'id_usuario_emisor' => 'integer',
        'fecha_expiracion' => 'datetime',
        'creado_en' => 'datetime',
    ];

    public function rol(): BelongsTo
    {
        return $this->belongsTo(Rol::class, 'id_rol', 'id_rol');
    }

    public function epi(): BelongsTo
    {
        return $this->belongsTo(Epi::class, 'id_epi', 'id_epi');
    }

    public function emisor(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'id_usuario_emisor', 'id_usuario');
    }

    public function solicitudes()
    {
        return $this->hasMany(SolicitudRegistro::class, 'id_link', 'id_link');
    }
}
