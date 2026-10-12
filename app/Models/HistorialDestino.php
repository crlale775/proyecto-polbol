<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HistorialDestino extends Model
{
    protected $table = 'historial_destinos';
    protected $primaryKey = 'id_historial';
    public $timestamps = false;

    protected $fillable = [
        'id_oficial',
        'id_epi',
        'fecha_inicio',
        'fecha_fin',
    ];

    protected $casts = [
        'id_oficial' => 'integer',
        'id_epi' => 'integer',
        'fecha_inicio' => 'date',
        'fecha_fin' => 'date',
    ];

    public function oficial(): BelongsTo
    {
        return $this->belongsTo(Oficial::class, 'id_oficial', 'id_oficial');
    }

    public function epi(): BelongsTo
    {
        return $this->belongsTo(Epi::class, 'id_epi', 'id_epi');
    }
}
