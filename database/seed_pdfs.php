<?php

/**
 * OFBOL — Generador de PDFs institucionales de respaldo
 * Crea un PDF válido para cada ruta referenciada en documentos, versiones_documento
 * y plantillas, de modo que el visor/descarga del sistema no devuelva 404.
 *
 * Uso: php database/seed_pdfs.php   (idempotente: no sobrescribe archivos existentes)
 */

$host = '127.0.0.1';
$port = '5432';
$dbname = 'comlapaz';
$user = 'postgres';
$password = 'ale775';

try {
    $pdo = new PDO("pgsql:host=$host;port=$port;dbname=$dbname", $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);

    $baseDir = __DIR__ . '/../storage/app/public';

    // Lista de rutas objetivo con metadatos para el contenido del PDF
    $objetivos = [];

    $rows = $pdo->query("
        SELECT d.ruta_pdf, d.codigo_documento, d.referencia, d.fecha_subida,
               e.nombre AS estado, o.nombres || ' ' || o.apellidos AS oficial,
               ep.nombre AS epi, t.nombre AS tipo
        FROM documentos d
        LEFT JOIN estados_documento e ON e.id_estado = d.estado_actual
        LEFT JOIN oficiales o ON o.id_oficial = d.id_oficial
        LEFT JOIN epis ep ON ep.id_epi = d.id_epi
        LEFT JOIN tipos_documento t ON t.id_tipo = d.id_tipo
    ")->fetchAll(PDO::FETCH_ASSOC);

    foreach ($rows as $r) {
        $objetivos[$r['ruta_pdf']] = [
            'codigo' => $r['codigo_documento'],
            'referencia' => $r['referencia'],
            'fecha' => $r['fecha_subida'],
            'estado' => $r['estado'],
            'oficial' => $r['oficial'],
            'epi' => $r['epi'],
            'tipo' => $r['tipo'],
        ];
    }

    // Versiones adicionales de documentos (rutas que no son el archivo actual)
    $versiones = $pdo->query("
        SELECT DISTINCT v.ruta_pdf, d.codigo_documento, d.referencia, v.fecha,
               e.nombre AS estado, o.nombres || ' ' || o.apellidos AS oficial,
               ep.nombre AS epi, t.nombre AS tipo
        FROM versiones_documento v
        JOIN documentos d ON d.id_documento = v.id_documento
        LEFT JOIN estados_documento e ON e.id_estado = d.estado_actual
        LEFT JOIN oficiales o ON o.id_oficial = d.id_oficial
        LEFT JOIN epis ep ON ep.id_epi = d.id_epi
        LEFT JOIN tipos_documento t ON t.id_tipo = d.id_tipo
    ")->fetchAll(PDO::FETCH_ASSOC);

    foreach ($versiones as $r) {
        if (isset($objetivos[$r['ruta_pdf']])) {
            continue;
        }
        $objetivos[$r['ruta_pdf']] = [
            'codigo' => $r['codigo_documento'],
            'referencia' => $r['referencia'],
            'fecha' => $r['fecha'],
            'estado' => $r['estado'],
            'oficial' => $r['oficial'],
            'epi' => $r['epi'],
            'tipo' => $r['tipo'],
        ];
    }

    $plantillas = $pdo->query("SELECT ruta_archivo, nombre FROM plantillas")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($plantillas as $p) {
        $ruta = ltrim($p['ruta_archivo'], '/');
        if (str_starts_with($ruta, 'storage/')) {
            $ruta = substr($ruta, strlen('storage/'));
        }
        $objetivos[$ruta] = [
            'codigo' => 'PLANTILLA OFICIAL',
            'referencia' => $p['nombre'],
            'tipo' => 'Plantilla institucional',
        ];
    }

    $creados = 0;
    $omitidos = 0;

    foreach ($objetivos as $relativa => $meta) {
        // Evitar rutas fuera de storage o con subida
        if (str_contains($relativa, '..') || str_starts_with($relativa, '/') || $relativa === '') {
            continue;
        }
        $destino = $baseDir . '/' . str_replace('\\', '/', $relativa);
        if (file_exists($destino)) {
            $omitidos++;
            continue;
        }
        @mkdir(dirname($destino), 0777, true);
        file_put_contents($destino, generarPdf($meta));
        $creados++;
        echo "  + $relativa\n";
    }

    echo "===============================================\n";
    echo " PDFs generados: $creados | ya existentes: $omitidos\n";
    echo " Directorio: storage/app/public\n";
    echo "===============================================\n";

} catch (Exception $e) {
    echo 'ERROR: ' . $e->getMessage() . "\n";
}

/**
 * Construye un PDF simple de una página con el contenido institucional.
 */
function generarPdf(array $meta): string
{
    $lineas = [
        'POLICIA BOLIVIANA - OFBOL',
        'Sistema de Gestion Documental - Comando Departamental de La Paz',
        '------------------------------------------------------------',
        'DOCUMENTO OFICIAL DIGITALIZADO (RESPALDO)',
        '',
        'Codigo:  ' . ($meta['codigo'] ?? ''),
        'Tipo:    ' . ($meta['tipo'] ?? ''),
        'Oficial: ' . ($meta['oficial'] ?? ''),
        'EPI:     ' . ($meta['epi'] ?? ''),
        'Estado:  ' . ($meta['estado'] ?? ''),
        'Fecha:   ' . ($meta['fecha'] ?? ''),
        '',
        'Referencia:',
        ($meta['referencia'] ?? ''),
        '',
        'Documento generado digitalmente para fines de verificacion',
        'institucional. Su hash SHA-256 queda registrado en el sistema.',
    ];

    $stream = "BT\n/F2 11 Tf 60 800 Td (POLICIA BOLIVIANA - OFBOL) Tj ET\n";
    $y = 760;
    foreach ($lineas as $linea) {
        $stream .= "BT\n/F1 10 Tf 60 $y Td (" . escPdf($linea) . ") Tj ET\n";
        $y -= 18;
    }
    $stream .= "BT\n/F2 8 Tf 60 120 Td (Pagina generada por OFBOL - Sistema de Gestion Documental) Tj ET\n";

    $pdf = "%PDF-1.4\n";
    $offsets = [];

    $offset = strlen($pdf);
    $pdf .= "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
    $offsets[] = $offset;

    $offset = strlen($pdf);
    $pdf .= "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
    $offsets[] = $offset;

    $offset = strlen($pdf);
    $pdf .= "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n";
    $offsets[] = $offset;

    $offset = strlen($pdf);
    $pdf .= "4 0 obj\n<< /Length " . strlen($stream) . " >>\nstream\n" . $stream . "endstream\nendobj\n";
    $offsets[] = $offset;

    $offset = strlen($pdf);
    $pdf .= "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n";
    $offsets[] = $offset;

    $offset = strlen($pdf);
    $pdf .= "6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";
    $offsets[] = $offset;

    $xref = strlen($pdf);
    $pdf .= "xref\n0 7\n0000000000 65535 f \n";
    foreach ($offsets as $o) {
        $pdf .= sprintf("%010d 00000 n \n", $o);
    }
    $pdf .= "trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n" . $xref . "\n%%EOF\n";

    return $pdf;
}

/**
 * Escapa texto para una cadena PDF (WinAnsi) y evita paréntesis/backslashes.
 */
function escPdf(string $texto): string
{
    $texto = mb_convert_encoding($texto, 'Windows-1252', 'UTF-8');
    $out = '';
    $len = strlen($texto);
    for ($i = 0; $i < $len; $i++) {
        $c = $texto[$i];
        $ord = ord($c);
        if ($ord === 40 || $ord === 41 || $ord === 92) { // ( ) \
            $out .= '\\' . $c;
        } elseif ($ord < 32 || $ord > 126) {
            $out .= sprintf('\\%03o', $ord);
        } else {
            $out .= $c;
        }
    }
    return $out;
}
