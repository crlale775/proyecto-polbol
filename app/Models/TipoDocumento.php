<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TipoDocumento extends Model
{
    protected $table = 'tipos_documento';
    protected $primaryKey = 'id_tipo';
    public $timestamps = false;

    protected $fillable = [
        'nombre',
    ];

    public function plantillas(): HasMany
    {
        return $this->hasMany(Plantilla::class, 'id_tipo_documento', 'id_tipo');
    }

    public function documentos(): HasMany
    {
        return $this->hasMany(Documento::class, 'id_tipo', 'id_tipo');
    }

    public function reglas(): HasMany
    {
        return $this->hasMany(Regla::class, 'tipo_documento', 'id_tipo');
    }
}
