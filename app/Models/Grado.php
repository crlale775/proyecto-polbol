<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Grado extends Model
{
    protected $table = 'grados';
    protected $primaryKey = 'id_grado';
    public $timestamps = false;

    protected $fillable = [
        'nombre',
        'abreviatura',
    ];

    public function oficiales(): HasMany
    {
        return $this->hasMany(Oficial::class, 'id_grado', 'id_grado');
    }
}
