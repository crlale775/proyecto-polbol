<?php

$host = '127.0.0.1';
$port = '5432';
$dbname = 'comlapaz';
$user = 'postgres';
$password = 'ale775';

try {
    $pdo = new PDO("pgsql:host=$host;port=$port;dbname=$dbname", $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);

    echo "Sincronizando secuencias de PostgreSQL en '$dbname'...\n";

    // Mapeo exacto de tabla -> columna primaria
    $tables = [
        'roles' => 'id_rol',
        'comando_departamental' => 'id_comando',
        'epis' => 'id_epi',
        'usuarios' => 'id_usuario',
        'sesiones' => 'id_sesion',
        'auditoria' => 'id_auditoria',
        'cargos' => 'id_cargo',
        'grados' => 'id_grado',
        'oficiales' => 'id_oficial',
        'historial_destinos' => 'id_historial',
        'tipos_documento' => 'id_tipo',
        'estados_documento' => 'id_estado',
        'tipos_observacion' => 'id_tipo',
        'plantillas' => 'id_plantilla',
        'configuracion' => 'id',
        'documentos' => 'id_documento',
        'versiones_documento' => 'id_version',
        'revisiones' => 'id_revision',
        'normas' => 'id_norma',
        'articulos' => 'id_articulo',
        'reglas' => 'id_regla',
        'validaciones' => 'id_validacion',
        'flujo_documentos' => 'id_flujo',
        'historial_estados' => 'id_historial',
        'notificaciones' => 'id_notificacion',
    ];

    foreach ($tables as $tbl => $pk) {
        // Obtener nombre de la secuencia asociada usando pg_get_serial_sequence
        $stmt = $pdo->prepare("SELECT pg_get_serial_sequence(:tbl, :pk)");
        $stmt->execute(['tbl' => $tbl, 'pk' => $pk]);
        $seq = $stmt->fetchColumn();

        if ($seq) {
            // Obtener el valor máximo actual
            $maxVal = $pdo->query("SELECT COALESCE(MAX($pk), 0) FROM $tbl")->fetchColumn();
            $nextVal = max((int)$maxVal, 1);
            
            // Actualizar secuencia
            $pdo->exec("SELECT setval('$seq', $nextVal, true)");
            echo " ✓ Secuencia $seq ($tbl.$pk): setval -> $nextVal\n";
        } else {
            // Intentar por convención de nombre
            $candidateSeq = "{$tbl}_{$pk}_seq";
            try {
                $maxVal = $pdo->query("SELECT COALESCE(MAX($pk), 0) FROM $tbl")->fetchColumn();
                $nextVal = max((int)$maxVal, 1);
                $pdo->exec("SELECT setval('$candidateSeq', $nextVal, true)");
                echo " ✓ Secuencia manual $candidateSeq ($tbl.$pk): setval -> $nextVal\n";
            } catch (Exception $e) {
                // Secuencia no existe
            }
        }
    }

    echo "\n¡Todas las secuencias fueron sincronizadas exitosamente!\n";

} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
