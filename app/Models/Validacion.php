<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Validacion extends Model
{
    protected $table = 'validaciones';
    protected $primaryKey = 'id_validacion';
    public $timestamps = false;

    protected $fillable = [
        'id_documento',
        'id_regla',
        'resultado',
        'mensaje',
        'fecha',
    ];

    protected $casts = [
        'id_documento' => 'integer',
        'id_regla' => 'integer',
        'fecha' => 'datetime',
    ];

    public function documento(): BelongsTo
    {
        return $this->belongsTo(Documento::class, 'id_documento', 'id_documento');
    }

    public function regla(): BelongsTo
    {
        return $this->belongsTo(Regla::class, 'id_regla', 'id_regla');
    }
}
