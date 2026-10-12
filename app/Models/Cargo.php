<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Cargo extends Model
{
    protected $table = 'cargos';
    protected $primaryKey = 'id_cargo';
    public $timestamps = false;

    protected $fillable = [
        'nombre',
    ];

    public function oficiales(): HasMany
    {
        return $this->hasMany(Oficial::class, 'id_cargo', 'id_cargo');
    }
}
