<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;

class Usuario extends Authenticatable
{
    protected $table = 'usuarios';
    protected $primaryKey = 'id_usuario';
    public $timestamps = false;

    protected $fillable = [
        'id_rol',
        'id_epi',
        'usuario',
        'password',
        'correo',
        'estado',
        'created_at',
        'foto',
    ];

    protected $hidden = [
        'password',
    ];

    protected $casts = [
        'id_rol' => 'integer',
        'id_epi' => 'integer',
        'estado' => 'boolean',
        'password' => 'hashed',
        'created_at' => 'datetime',
    ];

    public function rol(): BelongsTo
    {
        return $this->belongsTo(Rol::class, 'id_rol', 'id_rol');
    }

    public function epi(): BelongsTo
    {
        return $this->belongsTo(Epi::class, 'id_epi', 'id_epi');
    }

    public function sesiones(): HasMany
    {
        return $this->hasMany(Sesion::class, 'id_usuario', 'id_usuario');
    }

    public function auditorias(): HasMany
    {
        return $this->hasMany(Auditoria::class, 'id_usuario', 'id_usuario');
    }

    public function plantillas(): HasMany
    {
        return $this->hasMany(Plantilla::class, 'subido_por', 'id_usuario');
    }

    public function documentos(): HasMany
    {
        return $this->hasMany(Documento::class, 'id_usuario', 'id_usuario');
    }

    public function versionesDocumento(): HasMany
    {
        return $this->hasMany(VersionDocumento::class, 'subido_por', 'id_usuario');
    }

    public function revisiones(): HasMany
    {
        return $this->hasMany(Revision::class, 'usuario_revisor', 'id_usuario');
    }

    public function flujos(): HasMany
    {
        return $this->hasMany(FlujoDocumento::class, 'usuario', 'id_usuario');
    }

    public function historialEstados(): HasMany
    {
        return $this->hasMany(HistorialEstado::class, 'usuario', 'id_usuario');
    }

    public function notificaciones(): HasMany
    {
        return $this->hasMany(Notificacion::class, 'id_usuario', 'id_usuario');
    }
}
