<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * TipoMemo — patrón institucional de un tipo de memorándum.
 *
 * `formato` describe las secciones/campos del documento y `validaciones` las
 * reglas que el sistema exige. Ambos se persisten como JSONB.
 */
class TipoMemo extends Model
{
    protected $table = 'tipos_memo';
    protected $primaryKey = 'id_memo';
    public $timestamps = true;

    protected $fillable = [
        'id_tipo',
        'nombre',
        'codigo',
        'categoria',
        'descripcion',
        'formato',
        'validaciones',
        'color',
        'activo',
        'creado_por',
    ];

    protected $casts = [
        'id_tipo' => 'integer',
        'creado_por' => 'integer',
        'formato' => 'array',
        'validaciones' => 'array',
        'activo' => 'boolean',
    ];

    public function tipoDocumento(): BelongsTo
    {
        return $this->belongsTo(TipoDocumento::class, 'id_tipo', 'id_tipo');
    }

    public function creador(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'creado_por', 'id_usuario');
    }
}
