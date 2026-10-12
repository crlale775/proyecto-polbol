<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Regla extends Model
{
    protected $table = 'reglas';
    protected $primaryKey = 'id_regla';
    public $timestamps = false;

    protected $fillable = [
        'id_articulo',
        'nombre',
        'descripcion',
        'tipo_documento',
        'observacion_sugerida',
    ];

    protected $casts = [
        'id_articulo' => 'integer',
        'tipo_documento' => 'integer',
    ];

    public function articulo(): BelongsTo
    {
        return $this->belongsTo(Articulo::class, 'id_articulo', 'id_articulo');
    }

    public function tipoDocumento(): BelongsTo
    {
        return $this->belongsTo(TipoDocumento::class, 'tipo_documento', 'id_tipo');
    }

    public function validaciones(): HasMany
    {
        return $this->hasMany(Validacion::class, 'id_regla', 'id_regla');
    }
}
