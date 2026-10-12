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

    // 1. Poblar plantillas si está vacía
    $countPlantillas = $pdo->query("SELECT COUNT(*) FROM plantillas")->fetchColumn();
    if ($countPlantillas == 0) {
        $plantillas = [
            [1, 'Plantilla Oficial - Memorándum Disciplinario', '/storage/plantillas/plantilla_memo_disciplinario.pdf'],
            [2, 'Plantilla Oficial - Memorándum de Felicitación Institucional', '/storage/plantillas/plantilla_memo_felicitacion.pdf'],
            [3, 'Formulario Oficial - Solicitud de Permiso Policial', '/storage/plantillas/plantilla_formulario_permiso.pdf'],
            [4, 'Formulario Oficial - Solicitud de Vacación Anual Reglamentaria', '/storage/plantillas/plantilla_solicitud_vacacion.pdf'],
            [5, 'Formato Oficial - Memorándum de Designación de Funciones y Servicios', '/storage/plantillas/plantilla_designacion_funciones.pdf'],
            [6, 'Hoja de Ruta Institucional y Proveído de Trámite', '/storage/plantillas/plantilla_hoja_ruta.pdf'],
        ];

        $stmt = $pdo->prepare("INSERT INTO plantillas (tipo_documento, nombre, ruta_archivo) VALUES (?, ?, ?)");
        foreach ($plantillas as $p) {
            $stmt->execute($p);
        }
        echo "✓ Se insertaron 6 plantillas oficiales.\n";
    }

    // 2. Poblar auditoría si está vacía
    $countAuditoria = $pdo->query("SELECT COUNT(*) FROM auditoria")->fetchColumn();
    if ($countAuditoria == 0) {
        $auditorias = [
            [1, '2026-08-10 08:30:15', 'usuarios', 'LOGIN', 'Inicio de sesión exitoso del Secretario EPI 1 San Pedro'],
            [1, '2026-08-10 09:15:20', 'documentos', 'SUBIDA_DOCUMENTO', 'Subida del documento MEM-DISC-EPI1-2026-001 (Oficial Pérez Gutiérrez)'],
            [2, '2026-08-11 10:00:10', 'documentos', 'SUBIDA_DOCUMENTO', 'Subida del documento MEM-FEL-EPI2-2026-001 (Oficial Flores Calle)'],
            [10, '2026-08-12 11:20:00', 'revisiones', 'APROBACION_REVISION', 'Comando Departamental aprueba y remite trámite MEM-FEL-EPI2-2026-001'],
            [10, '2026-08-13 14:45:10', 'revisiones', 'OBSERVACION_TRAMITE', 'Comando Departamental emite observación formal a trámite MEM-DISC-EPI6-2026-003'],
            [11, '2026-08-14 16:30:00', 'historial_estados', 'REGISTRO_FINAL', 'Comando General confirma recepción oficial y registro de trámite DESIG-EPI9-2026-014'],
            [10, '2026-08-15 09:10:00', 'usuarios', 'CAMBIO_ESTADO', 'Comando Departamental actualiza datos del secretario de EPI 4 Munaypata'],
            [11, '2026-08-16 17:00:25', 'configuracion', 'AUDITORIA_SISTEMA', 'Verificación de integridad criptográfica y trazabilidad global'],
        ];

        $stmt = $pdo->prepare("INSERT INTO auditoria (id_usuario, fecha, tabla, accion, descripcion) VALUES (?, ?, ?, ?, ?)");
        foreach ($auditorias as $a) {
            $stmt->execute($a);
        }
        echo "✓ Se insertaron 8 registros de auditoría.\n";
    }

    // Sincronizar secuencias
    $pdo->exec("SELECT setval('plantillas_id_plantilla_seq', (SELECT COALESCE(MAX(id_plantilla), 1) FROM plantillas), true)");
    $pdo->exec("SELECT setval('auditoria_id_auditoria_seq', (SELECT COALESCE(MAX(id_auditoria), 1) FROM auditoria), true)");
    echo "✓ Secuencias sincronizadas.\n";

} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
