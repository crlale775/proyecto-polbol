<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SolicitudRegistro extends Model
{
    protected $table = 'solicitudes_registro';
    protected $primaryKey = 'id_solicitud';
    public $timestamps = false;

    protected $fillable = [
        'id_link',
        'token',
        'id_rol',
        'id_epi',
        'nombres',
        'apellidos',
        'ci',
        'telefono',
        'usuario',
        'ruta_memo',
        'ruta_foto',
        'hash_memo',
        'estado_solicitud',
        'ia_estado',
        'ia_firma',
        'ia_sello',
        'ia_nombres',
        'ia_coincide',
        'ia_advertencia',
        'ia_rostro',
        'ia_mensaje',
        'observacion',
        'id_usuario_creado',
        'creado_en',
        'ia_verificado_en',
        'resuelto_en',
    ];

    protected $casts = [
        'id_rol' => 'integer',
        'id_epi' => 'integer',
        'ia_firma' => 'boolean',
        'ia_sello' => 'boolean',
        'ia_coincide' => 'boolean',
        'ia_advertencia' => 'boolean',
        'ia_rostro' => 'boolean',
        'id_usuario_creado' => 'integer',
        'creado_en' => 'datetime',
        'ia_verificado_en' => 'datetime',
        'resuelto_en' => 'datetime',
    ];

    public function link(): BelongsTo
    {
        return $this->belongsTo(RegistroLink::class, 'id_link', 'id_link');
    }

    public function rol(): BelongsTo
    {
        return $this->belongsTo(Rol::class, 'id_rol', 'id_rol');
    }

    public function epi(): BelongsTo
    {
        return $this->belongsTo(Epi::class, 'id_epi', 'id_epi');
    }

    public function usuarioCreado(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'id_usuario_creado', 'id_usuario');
    }

    public function getNombresDetectadosAttribute(): array
    {
        if (!$this->ia_nombres) {
            return [];
        }
        $decoded = json_decode($this->ia_nombres, true);

        return is_array($decoded) ? $decoded : [];
    }

    public function getNombreCompletoAttribute(): string
    {
        return trim(($this->nombres ?? '') . ' ' . ($this->apellidos ?? ''));
    }
}
