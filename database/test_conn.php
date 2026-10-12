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

    echo "==============================================\n";
    echo " VERIFICACION COMPLETA DE LA BD: $dbname\n";
    echo "==============================================\n\n";

    // Usuarios + Roles + EPIs
    echo "--- USUARIOS ACTIVOS (11 usuarios) ---\n";
    $stmt = $pdo->query("
        SELECT u.id_usuario, u.usuario, r.nombre AS rol, e.nombre AS epi
        FROM usuarios u
        JOIN roles r ON r.id_rol = u.id_rol
        LEFT JOIN epis e ON e.id_epi = u.id_epi
        ORDER BY u.id_usuario
    ");
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $epi = $row['epi'] ?? 'N/A (Mando Superior)';
        echo "  [{$row['id_usuario']}] {$row['usuario']} | Rol: {$row['rol']} | EPI: $epi\n";
    }

    echo "\n--- DOCUMENTOS DE PRUEBA (12 trámites) ---\n";
    $stmt = $pdo->query("
        SELECT d.codigo_documento, ed.nombre AS estado,
               o.nombres || ' ' || o.apellidos AS oficial,
               e.nombre AS epi
        FROM documentos d
        JOIN estados_documento ed ON ed.id_estado = d.estado_actual
        JOIN oficiales o ON o.id_oficial = d.id_oficial
        JOIN epis e ON e.id_epi = d.id_epi
        ORDER BY d.fecha_subida DESC
    ");
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        echo "  {$row['codigo_documento']} | {$row['estado']} | {$row['oficial']} | {$row['epi']}\n";
    }

    echo "\n--- CONTRASEÑA UNIFICADA para todos los usuarios: ale775 ---\n";

} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
