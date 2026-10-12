<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Configuracion extends Model
{
    protected $table = 'configuracion';
    protected $primaryKey = 'id';
    public $timestamps = false;

    protected $fillable = [
        'nombre',
        'valor',
    ];
}
