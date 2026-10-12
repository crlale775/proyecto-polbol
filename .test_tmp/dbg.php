<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use App\Services\VerificadorIA;
$v = $app->make(VerificadorIA::class);
$m = new ReflectionMethod($v, 'coinciden');
$m->setAccessible(true);
foreach ([
    ['Jose Carlos Mamani Flores', ['Alejandra']],
    ['Jose Carlos Mamani Flores', ['Alejandro Quispe Mamani']],
    ['Estela Santusa Huallpa Mamani', ['Estela']],
    ['Jose Carlos Mamani Flores', ['Jose Carlos Mamani Flores']],
] as [$e, $d]) {
    echo json_encode([$e, $d, $m->invoke($v, $e, $d)]), "\n";
}
