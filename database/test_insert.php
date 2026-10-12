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

    $stmt = $pdo->prepare('INSERT INTO historial_estados (id_documento, estado_anterior, estado_nuevo, usuario, fecha) VALUES (?, ?, ?, ?, ?) RETURNING id_historial');
    $stmt->execute([9, 7, 8, 11, date('Y-m-d H:i:s')]);
    $newId = $stmt->fetchColumn();
    echo "¡INSERT EXITOSO! Nuevo id_historial generado: $newId\n";

} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
