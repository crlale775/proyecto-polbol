<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TipoObservacion extends Model
{
    protected $table = 'tipos_observacion';
    protected $primaryKey = 'id_tipo';
    public $timestamps = false;

    protected $fillable = [
        'nombre',
        'descripcion',
    ];

    public function revisiones(): HasMany
    {
        return $this->hasMany(Revision::class, 'id_tipo_observacion', 'id_tipo');
    }
}
