<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ComandoDepartamental extends Model
{
    protected $table = 'comando_departamental';
    protected $primaryKey = 'id_comando';
    public $timestamps = false;

    protected $fillable = [
        'nombre',
        'departamento',
    ];

    public function epis(): HasMany
    {
        return $this->hasMany(Epi::class, 'id_comando', 'id_comando');
    }
}
