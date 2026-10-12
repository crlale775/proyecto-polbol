<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VersionDocumento extends Model
{
    protected $table = 'versiones_documento';
    protected $primaryKey = 'id_version';
    public $timestamps = false;

    protected $fillable = [
        'id_documento',
        'version',
        'ruta_pdf',
        'fecha',
        'subido_por',
    ];

    protected $casts = [
        'id_documento' => 'integer',
        'version' => 'integer',
        'subido_por' => 'integer',
        'fecha' => 'datetime',
    ];

    public function documento(): BelongsTo
    {
        return $this->belongsTo(Documento::class, 'id_documento', 'id_documento');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'subido_por', 'id_usuario');
    }
}
