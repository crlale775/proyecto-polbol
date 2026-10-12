<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Services\VerificadorIA;
$v = $app->make(VerificadorIA::class);
$r = $v->analizar(__DIR__ . '/memo_designa_alejandro.pdf', ['nombres' => 'Jose Carlos', 'apellidos' => 'Mamani Flores']);
echo json_encode(['firma' => $r['firma'], 'sello' => $r['sello'], 'destinatario' => $r['destinatario'], 'coincide' => $r['coincide'], 'mensaje' => $r['mensaje'], 'raw' => $r['raw']['respuesta_ia']], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
