<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Norma extends Model
{
    protected $table = 'normas';
    protected $primaryKey = 'id_norma';
    public $timestamps = false;

    protected $fillable = [
        'codigo',
        'nombre',
        'version',
        'vigente',
        'fecha_inicio',
        'fecha_fin',
    ];

    protected $casts = [
        'vigente' => 'boolean',
        'fecha_inicio' => 'date',
        'fecha_fin' => 'date',
    ];

    public function articulos(): HasMany
    {
        return $this->hasMany(Articulo::class, 'id_norma', 'id_norma');
    }
}
