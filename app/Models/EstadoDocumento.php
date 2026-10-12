<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EstadoDocumento extends Model
{
    protected $table = 'estados_documento';
    protected $primaryKey = 'id_estado';
    public $timestamps = false;

    protected $fillable = [
        'nombre',
    ];

    public function documentos(): HasMany
    {
        return $this->hasMany(Documento::class, 'estado_actual', 'id_estado');
    }
}
