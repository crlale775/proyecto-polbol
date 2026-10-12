<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Articulo extends Model
{
    protected $table = 'articulos';
    protected $primaryKey = 'id_articulo';
    public $timestamps = false;

    protected $fillable = [
        'id_norma',
        'numero',
        'titulo',
        'texto',
    ];

    protected $casts = [
        'id_norma' => 'integer',
    ];

    public function norma(): BelongsTo
    {
        return $this->belongsTo(Norma::class, 'id_norma', 'id_norma');
    }

    public function reglas(): HasMany
    {
        return $this->hasMany(Regla::class, 'id_articulo', 'id_articulo');
    }
}
