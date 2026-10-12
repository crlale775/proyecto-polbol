<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Epi extends Model
{
    protected $table = 'epis';
    protected $primaryKey = 'id_epi';
    public $timestamps = false;

    protected $fillable = [
        'id_comando',
        'nombre',
        'direccion',
        'telefono',
        'estado',
    ];

    protected $casts = [
        'id_comando' => 'integer',
        'estado' => 'boolean',
    ];

    public function comandoDepartamental(): BelongsTo
    {
        return $this->belongsTo(ComandoDepartamental::class, 'id_comando', 'id_comando');
    }

    public function usuarios(): HasMany
    {
        return $this->hasMany(Usuario::class, 'id_epi', 'id_epi');
    }

    public function oficiales(): HasMany
    {
        return $this->hasMany(Oficial::class, 'id_epi', 'id_epi');
    }

    public function historialDestinos(): HasMany
    {
        return $this->hasMany(HistorialDestino::class, 'id_epi', 'id_epi');
    }

    public function documentos(): HasMany
    {
        return $this->hasMany(Documento::class, 'id_epi', 'id_epi');
    }

    public function flujosOrigen(): HasMany
    {
        return $this->hasMany(FlujoDocumento::class, 'origen_epi', 'id_epi');
    }

    public function flujosDestino(): HasMany
    {
        return $this->hasMany(FlujoDocumento::class, 'destino_epi', 'id_epi');
    }
}
