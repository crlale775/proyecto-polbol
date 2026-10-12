<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Documento extends Model
{
    protected $table = 'documentos';
    protected $primaryKey = 'id_documento';
    public $timestamps = false;

    protected $fillable = [
        'id_tipo',
        'id_oficial',
        'id_usuario',
        'id_epi',
        'codigo_documento',
        'referencia',
        'ruta_pdf',
        'hash',
        'fecha_subida',
        'estado_actual',
    ];

    protected $casts = [
        'id_tipo' => 'integer',
        'id_oficial' => 'integer',
        'id_usuario' => 'integer',
        'id_epi' => 'integer',
        'estado_actual' => 'integer',
        'fecha_subida' => 'datetime',
    ];

    public function tipoDocumento(): BelongsTo
    {
        return $this->belongsTo(TipoDocumento::class, 'id_tipo', 'id_tipo');
    }

    public function oficial(): BelongsTo
    {
        return $this->belongsTo(Oficial::class, 'id_oficial', 'id_oficial');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'id_usuario', 'id_usuario');
    }

    public function epi(): BelongsTo
    {
        return $this->belongsTo(Epi::class, 'id_epi', 'id_epi');
    }

    public function estado(): BelongsTo
    {
        return $this->belongsTo(EstadoDocumento::class, 'estado_actual', 'id_estado');
    }

    public function versiones(): HasMany
    {
        return $this->hasMany(VersionDocumento::class, 'id_documento', 'id_documento');
    }

    public function revisiones(): HasMany
    {
        return $this->hasMany(Revision::class, 'id_documento', 'id_documento');
    }

    public function validaciones(): HasMany
    {
        return $this->hasMany(Validacion::class, 'id_documento', 'id_documento');
    }

    public function flujos(): HasMany
    {
        return $this->hasMany(FlujoDocumento::class, 'id_documento', 'id_documento');
    }

    public function historialEstados(): HasMany
    {
        return $this->hasMany(HistorialEstado::class, 'id_documento', 'id_documento');
    }

    public function notificaciones(): HasMany
    {
        return $this->hasMany(Notificacion::class, 'id_documento', 'id_documento');
    }
}
