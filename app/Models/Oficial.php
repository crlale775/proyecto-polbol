<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Oficial extends Model
{
    protected $table = 'oficiales';
    protected $primaryKey = 'id_oficial';
    public $timestamps = false;

    protected $fillable = [
        'id_grado',
        'id_epi',
        'id_cargo',
        'numero_item',
        'codigo_institucional',
        'escalafon',
        'ci',
        'nombres',
        'apellidos',
        'estado',
        'foto',
    ];

    protected $casts = [
        'id_grado' => 'integer',
        'id_epi' => 'integer',
        'id_cargo' => 'integer',
        'estado' => 'boolean',
    ];

    public function grado(): BelongsTo
    {
        return $this->belongsTo(Grado::class, 'id_grado', 'id_grado');
    }

    public function epi(): BelongsTo
    {
        return $this->belongsTo(Epi::class, 'id_epi', 'id_epi');
    }

    public function cargo(): BelongsTo
    {
        return $this->belongsTo(Cargo::class, 'id_cargo', 'id_cargo');
    }

    public function historialDestinos(): HasMany
    {
        return $this->hasMany(HistorialDestino::class, 'id_oficial', 'id_oficial');
    }

    public function documentos(): HasMany
    {
        return $this->hasMany(Documento::class, 'id_oficial', 'id_oficial');
    }
}
