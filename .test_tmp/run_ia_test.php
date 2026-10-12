<?php

require __DIR__ . '/../vendor/autoload.php';

$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\VerificadorIA;

$v = $app->make(VerificadorIA::class);

function probar(VerificadorIA $v, string $pdf, string $nombres, string $apellidos): array
{
    $t0 = microtime(true);
    try {
        $r = $v->analizar($pdf, ['nombres' => $nombres, 'apellidos' => $apellidos]);

        return [
            'ok' => true,
            'segundos' => round(microtime(true) - $t0, 1),
            'firma' => $r['firma'],
            'sello' => $r['sello'],
            'destinatario_leido' => $r['destinatario'],
            'autoridad_leida' => $r['autoridad'],
            'coincide' => $r['coincide'],
            'mensaje' => $r['mensaje'],
            'raw_respuesta' => $r['raw']['respuesta_ia'] ?? null,
            'raw_datos' => $r['raw']['datos'] ?? null,
        ];
    } catch (\Throwable $e) {
        return ['ok' => false, 'error' => $e->getMessage()];
    }
}

echo json_encode([
    'caso_A' => [
        'descripcion' => 'Memo designa a ALEJANDRO QUISPE MAMANI · registrado como Jose Carlos Mamani Flores',
        'resultado' => probar($v, __DIR__ . '/memo_designa_alejandro.pdf', 'Jose Carlos', 'Mamani Flores'),
    ],
    'caso_B' => [
        'descripcion' => 'Memo designa a ESTELA SANTUSA HUALLPA MAMANI · registrada igual (coincidencia real)',
        'resultado' => probar($v, __DIR__ . '/memo_designa_estela.pdf', 'Estela Santusa', 'Huallpa Mamani'),
    ],
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
