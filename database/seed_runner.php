<?php

/**
 * OFBOL — Seed Completo de Datos de Prueba para PostgreSQL (comlapaz)
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
    echo "===============================================\n";
    echo " CONECTADO A BASE DE DATOS: $dbname\n";
    echo "===============================================\n";

    // 1. Sincronizar estructura faltante según base
    echo "-> Verificando estructura de tablas según 'base'...\n";
    
    // Tabla comando_departamental
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS comando_departamental (
            id_comando SERIAL PRIMARY KEY,
            nombre VARCHAR(100) NOT NULL DEFAULT 'Comando Departamental de La Paz',
            departamento VARCHAR(50) NOT NULL DEFAULT 'La Paz'
        );
    ");

    // Tabla epis
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS epis (
            id_epi SERIAL PRIMARY KEY,
            id_comando INT NOT NULL DEFAULT 1,
            nombre VARCHAR(100) NOT NULL,
            direccion TEXT,
            telefono VARCHAR(20),
            estado BOOLEAN NOT NULL DEFAULT TRUE
        );
    ");

    // Asegurar columna id_epi en usuarios
    $pdo->exec("
        ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS id_epi INT;
    ");

    // Asegurar tabla notificaciones
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS notificaciones (
            id_notificacion BIGSERIAL PRIMARY KEY,
            id_usuario INT NOT NULL,
            id_documento BIGINT,
            titulo VARCHAR(150) NOT NULL,
            mensaje TEXT NOT NULL,
            leido BOOLEAN NOT NULL DEFAULT FALSE,
            fecha TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_notificaciones_usuarios FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE CASCADE
        );
    ");

    // Asegurar columnas en oficiales
    $pdo->exec("
        ALTER TABLE oficiales ADD COLUMN IF NOT EXISTS numero_item VARCHAR(20);
        ALTER TABLE oficiales ADD COLUMN IF NOT EXISTS codigo_institucional VARCHAR(30);
    ");

    // Asegurar columnas en revisiones y tipos_observacion
    $pdo->exec("
        ALTER TABLE revisiones ADD COLUMN IF NOT EXISTS id_tipo_observacion INT;
        ALTER TABLE revisiones ADD COLUMN IF NOT EXISTS nivel_revision VARCHAR(50);
        ALTER TABLE revisiones ADD COLUMN IF NOT EXISTS observacion_libre TEXT;
        ALTER TABLE tipos_observacion ADD COLUMN IF NOT EXISTS descripcion TEXT;
    ");

    // Obtener lista de tablas existentes
    $stmtTables = $pdo->query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    $existingTables = $stmtTables->fetchAll(PDO::FETCH_COLUMN);

    echo "-> Limpiando tablas existentes de forma segura...\n";
    if (!empty($existingTables)) {
        $pdo->exec("TRUNCATE TABLE " . implode(', ', $existingTables) . " RESTART IDENTITY CASCADE;");
    }

    $pdo->beginTransaction();

    // -------------------------------------------------------------
    // 1. COMANDO DEPARTAMENTAL
    // -------------------------------------------------------------
    echo "-> Insertando Comando Departamental...\n";
    $pdo->exec("
        INSERT INTO comando_departamental (id_comando, nombre, departamento) VALUES
        (1, 'Comando Departamental de Policía La Paz', 'La Paz');
    ");

    // -------------------------------------------------------------
    // 2. ROLES (3 Roles del Sistema)
    // -------------------------------------------------------------
    echo "-> Insertando Roles...\n";
    $pdo->exec("
        INSERT INTO roles (id_rol, nombre, descripcion, estado) VALUES
        (1, 'Secretario EPI', 'Secretario de Unidad policial encargado de la recepción y registro de memorándums físicos de su EPI asignada.', TRUE),
        (2, 'Comando Departamental', 'Órgano revisor del Comando Departamental de La Paz encargado del dictamen, aprobación o devolución de trámites de las 9 EPIs.', TRUE),
        (3, 'Comando General', 'Instancia máxima policial de destino final para recepción, respaldo y registro en escalafón.', TRUE);
    ");

    // -------------------------------------------------------------
    // 3. LAS 9 EPIS DEL DEPARTAMENTO DE LA PAZ
    // -------------------------------------------------------------
    echo "-> Insertando las 9 EPIs de La Paz...\n";
    $pdo->exec("
        INSERT INTO epis (id_epi, id_comando, nombre, direccion, telefono, estado) VALUES
        (1, 1, 'EPI 1 San Pedro', 'Plaza Sucre s/n, Zona San Pedro, La Paz', '2-2490123', TRUE),
        (2, 1, 'EPI 2 Sur (Chasquipampa)', 'Av. Costanera esq. Calle 15, Calacoto - Zona Sur, La Paz', '2-2794567', TRUE),
        (3, 1, 'EPI 3 Ferroviaria', 'Av. Vásquez / Zona Pura Pura, La Paz', '2-2281144', TRUE),
        (4, 1, 'EPI 4 Munaypata', 'Av. Naciones Unidas s/n, Munaypata, La Paz', '2-2384455', TRUE),
        (5, 1, 'EPI 5 Cotahuma', 'Av. Buenos Aires / Pasaje Alcoreza, Cotahuma, La Paz', '2-2419988', TRUE),
        (6, 1, 'EPI 6 Chijini', 'Av. Entre Ríos / Max Paredes, Chijini, La Paz', '2-2456677', TRUE),
        (7, 1, 'EPI 7 Centro', 'Calle Sucre esq. Junín, Centro Histórico, La Paz', '2-2203344', TRUE),
        (8, 1, 'EPI 8 Bosquecillo', 'Zona Panticirca / Bosquecillo, La Paz', '2-2841234', TRUE),
        (9, 1, 'EPI 9 Merced', 'Av. Ramiro Castillo, La Merced / Villa Fátima, La Paz', '2-2219900', TRUE);
    ");

    // -------------------------------------------------------------
    // 4. USUARIOS (9 Secretarios de Unidad + 1 Revisor Dptal + 1 Comando General)
    // -------------------------------------------------------------
    echo "-> Insertando Usuarios (9 Secretarios de las 9 EPIs + 2 Mandos Superiores)...\n";
    $hashPass = password_hash('ale775', PASSWORD_BCRYPT);

    $stmtUser = $pdo->prepare("
        INSERT INTO usuarios (id_usuario, id_rol, id_epi, usuario, password, correo, estado) VALUES
        (1, 1, 1, 'sec_sanpedro', :pass, 'sec.sanpedro@policia.bo', TRUE),
        (2, 1, 2, 'sec_sur', :pass, 'sec.sur@policia.bo', TRUE),
        (3, 1, 3, 'sec_ferroviaria', :pass, 'sec.ferroviaria@policia.bo', TRUE),
        (4, 1, 4, 'sec_munaypata', :pass, 'sec.munaypata@policia.bo', TRUE),
        (5, 1, 5, 'sec_cotahuma', :pass, 'sec.cotahuma@policia.bo', TRUE),
        (6, 1, 6, 'sec_chijini', :pass, 'sec.chijini@policia.bo', TRUE),
        (7, 1, 7, 'sec_centro', :pass, 'sec.centro@policia.bo', TRUE),
        (8, 1, 8, 'sec_bosquecillo', :pass, 'sec.bosquecillo@policia.bo', TRUE),
        (9, 1, 9, 'sec_merced', :pass, 'sec.merced@policia.bo', TRUE),
        (10, 2, NULL, 'revisor_lapaz', :pass, 'revisor.cdlp@policia.bo', TRUE),
        (11, 3, NULL, 'comando_general', :pass, 'comando.general@policia.bo', TRUE);
    ");
    $stmtUser->execute(['pass' => $hashPass]);

    // -------------------------------------------------------------
    // 5. GRADOS POLICIALES
    // -------------------------------------------------------------
    echo "-> Insertando Grados Policiales...\n";
    $pdo->exec("
        INSERT INTO grados (id_grado, nombre, abreviatura) VALUES
        (1, 'Coronel', 'Cnel.'),
        (2, 'Teniente Coronel', 'Tcnl.'),
        (3, 'Mayor', 'My.'),
        (4, 'Capitán', 'Cap.'),
        (5, 'Teniente', 'Tte.'),
        (6, 'Subteniente', 'Sbtte.'),
        (7, 'Suboficial Mayor', 'Sof. My.'),
        (8, 'Suboficial Primero', 'Sof. 1ro.'),
        (9, 'Suboficial Segundo', 'Sof. 2do.'),
        (10, 'Sargento Primero', 'Sgto. 1ro.'),
        (11, 'Sargento Segundo', 'Sgto. 2do.'),
        (12, 'Cabo', 'Cbo.'),
        (13, 'Policía', 'Pol.');
    ");

    // -------------------------------------------------------------
    // 6. CARGOS POLICIALES
    // -------------------------------------------------------------
    echo "-> Insertando Cargos Policiales...\n";
    $pdo->exec("
        INSERT INTO cargos (id_cargo, nombre) VALUES
        (1, 'Comandante de Guardia'),
        (2, 'Jefe de Operaciones'),
        (3, 'Investigador FELCC'),
        (4, 'Investigador FELCV'),
        (5, 'Oficial de Tránsito'),
        (6, 'Patrullero 110'),
        (7, 'Auxiliar Administrativo'),
        (8, 'Encargado de Armamento y Equipo');
    ");

    // -------------------------------------------------------------
    // 7. OFICIALES DE LA POLICÍA (Distribuidos en las 9 EPIs)
    // -------------------------------------------------------------
    echo "-> Insertando Oficiales en las 9 EPIs...\n";
    $pdo->exec("
        INSERT INTO oficiales (id_oficial, id_grado, id_epi, id_cargo, numero_item, codigo_institucional, escalafon, ci, nombres, apellidos, estado) VALUES
        (1, 3, 1, 2, 'IT-10023', 'POL-LPZ-001', 'ESC-78901', '4892301-LP', 'Marcelo Alejandro', 'Pérez Gutiérrez', TRUE),
        (2, 4, 1, 1, 'IT-10024', 'POL-LPZ-002', 'ESC-78902', '5934102-LP', 'Fernando Daniel', 'Quispe Mamani', TRUE),
        (3, 10, 1, 6, 'IT-10025', 'POL-LPZ-003', 'ESC-78903', '6748910-LP', 'Gonzalo René', 'Condori Choque', TRUE),
        (4, 3, 2, 2, 'IT-20011', 'POL-SUR-001', 'ESC-81011', '5129403-LP', 'Jorge Luis', 'Vargas Miranda', TRUE),
        (5, 5, 2, 3, 'IT-20012', 'POL-SUR-002', 'ESC-81012', '7201948-LP', 'Álvaro Mauricio', 'Flores Calle', TRUE),
        (6, 11, 2, 6, 'IT-20013', 'POL-SUR-003', 'ESC-81013', '8392014-LP', 'Rodrigo Andrés', 'Mendoza Ramos', TRUE),
        (7, 4, 3, 1, 'IT-30045', 'POL-FER-001', 'ESC-83401', '4839201-LP', 'Carlos Eduardo', 'Rios Salazar', TRUE),
        (8, 6, 3, 5, 'IT-30046', 'POL-FER-002', 'ESC-83402', '6930219-LP', 'Cristian David', 'Apaza Torrez', TRUE),
        (9, 3, 4, 2, 'IT-40089', 'POL-MUN-001', 'ESC-84511', '5849302-LP', 'Hugo Rolando', 'Zeballos Castro', TRUE),
        (10, 5, 4, 4, 'IT-40090', 'POL-MUN-002', 'ESC-84512', '7103948-LP', 'Patricia Andrea', 'Limachi Guzman', TRUE),
        (11, 4, 5, 1, 'IT-50021', 'POL-COT-001', 'ESC-85901', '6039481-LP', 'Oscar Javier', 'Tarqui Huanca', TRUE),
        (12, 10, 5, 6, 'IT-50022', 'POL-COT-002', 'ESC-85902', '8294019-LP', 'Milton Freddy', 'Colque Poma', TRUE),
        (13, 3, 6, 2, 'IT-60033', 'POL-CHI-001', 'ESC-86711', '4930291-LP', 'Víctor Hugo', 'Navarro Solares', TRUE),
        (14, 5, 6, 3, 'IT-60034', 'POL-CHI-002', 'ESC-86712', '6920194-LP', 'Diego Armando', 'Beltrán Luna', TRUE),
        (15, 2, 7, 2, 'IT-70001', 'POL-CEN-001', 'ESC-87001', '3940192-LP', 'Ramiro Antonio', 'Castillo Vaca', TRUE),
        (16, 4, 7, 1, 'IT-70002', 'POL-CEN-002', 'ESC-87002', '5839201-LP', 'Sergio Roberto', 'Paredes Loza', TRUE),
        (17, 10, 7, 6, 'IT-70003', 'POL-CEN-003', 'ESC-87003', '7492014-LP', 'Wilfredo Juan', 'Ticona Acarapi', TRUE),
        (18, 4, 8, 1, 'IT-80015', 'POL-BOS-001', 'ESC-88121', '5930294-LP', 'Rubén Dario', 'Chávez Ponce', TRUE),
        (19, 6, 8, 5, 'IT-80016', 'POL-BOS-002', 'ESC-88122', '8192039-LP', 'Alejandro Boris', 'Yana Quisberth', TRUE),
        (20, 3, 9, 2, 'IT-90050', 'POL-MER-001', 'ESC-89301', '4820194-LP', 'Guido Hernán', 'Salinas Rocha', TRUE),
        (21, 5, 9, 4, 'IT-90051', 'POL-MER-002', 'ESC-89302', '6940291-LP', 'Mónica Silvia', 'Vargas Peñaranda', TRUE);
    ");

    // -------------------------------------------------------------
    // 8. TIPOS DE DOCUMENTO
    // -------------------------------------------------------------
    echo "-> Insertando Tipos de Documento...\n";
    $pdo->exec("
        INSERT INTO tipos_documento (id_tipo, nombre) VALUES
        (1, 'Memorándum disciplinario'),
        (2, 'Memorándum felicitación'),
        (3, 'Permiso'),
        (4, 'Vacación'),
        (5, 'Designación'),
        (6, 'Otro');
    ");

    // -------------------------------------------------------------
    // 9. ESTADOS DE DOCUMENTO
    // -------------------------------------------------------------
    echo "-> Insertando Estados de Documento...\n";
    $pdo->exec("
        INSERT INTO estados_documento (id_estado, nombre) VALUES
        (1, 'Borrador'),
        (2, 'Enviado por EPI'),
        (3, 'En revisión'),
        (4, 'Observado'),
        (5, 'Devuelto'),
        (6, 'Aprobado'),
        (7, 'Remitido al Comando General'),
        (8, 'Registrado');
    ");

    // -------------------------------------------------------------
    // 10. TIPOS DE OBSERVACIÓN
    // -------------------------------------------------------------
    echo "-> Insertando Tipos de Observación...\n";
    $pdo->exec("
        INSERT INTO tipos_observacion (id_tipo, nombre, descripcion) VALUES
        (1, 'Falta firma', 'Falta la firma física o digital de la autoridad responsable en el documento.'),
        (2, 'Fecha incorrecta', 'Inconsistencia o desfase temporal en las fechas consignadas en el trámite.'),
        (3, 'No coincide el número', 'El correlativo de memorándum no coincide con el libro de altas de la unidad.'),
        (4, 'PDF ilegible', 'Baja resolución de escaneo o contenido borroso que impide la lectura fehaciente.'),
        (5, 'Documento incompleto', 'Faltan fojas anexas, informes de respaldo o sellos institucionales de rigor.'),
        (6, 'Datos inconsistentes', 'Discrepancia en los datos de filiación, cédula de identidad o grado del oficial.'),
        (7, 'Otro', 'Observaciones varias de índole formal o administrativa.');
    ");

    // -------------------------------------------------------------
    // 11. DOCUMENTOS DE PRUEBA (Flujo Completo)
    // -------------------------------------------------------------
    echo "-> Insertando Documentos de Prueba en diversos estados...\n";
    $pdo->exec("
        INSERT INTO documentos (id_documento, id_tipo, id_oficial, id_usuario, id_epi, codigo_documento, referencia, ruta_pdf, hash, fecha_subida, estado_actual) VALUES
        -- Trámites en Revisión / Pendientes de dictamen (Para Comando Departamental)
        (1, 1, 1, 1, 1, 'MEM-DISC-EPI1-2026-001', 'Falta disciplinaria leve por retraso injustificado a formación', 'documentos/memo_disc_001.pdf', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', '2026-08-17 08:30:00', 2),
        (2, 2, 4, 2, 2, 'MEM-FEL-EPI2-2026-004', 'Felicitación pública por destacada labor en operativo Zona Sur', 'documentos/memo_fel_004.pdf', '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a', '2026-08-17 09:15:00', 2),
        (3, 4, 7, 3, 3, 'SOL-VAC-EPI3-2026-012', 'Solicitud de vacación anual reglamentaria periodo 2025-2026', 'documentos/sol_vac_012.pdf', 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d', '2026-08-17 10:00:00', 3),
        (4, 5, 9, 4, 4, 'DESIG-EPI4-2026-008', 'Designación temporal de funciones como encargado de patrullaje', 'documentos/desig_008.pdf', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', '2026-08-17 10:45:00', 2),
        (5, 3, 11, 5, 5, 'PERM-EPI5-2026-019', 'Permiso especial por motivos de salud con baja médica', 'documentos/perm_019.pdf', 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e', '2026-08-17 11:20:00', 2),

        -- Trámites Observados / Devueltos a la EPI
        (6, 1, 13, 6, 6, 'MEM-DISC-EPI6-2026-003', 'Amonestación por incumplimiento de directiva de seguridad', 'documentos/memo_disc_003.pdf', '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b', '2026-08-16 14:00:00', 4),
        (7, 3, 18, 8, 8, 'PERM-EPI8-2026-005', 'Permiso por comisión de servicio en retén La Cumbre', 'documentos/perm_005.pdf', 'd4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35', '2026-08-16 16:30:00', 5),

        -- Trámites Aprobados por Comando Dptal. (En Bandeja de Comando General)
        (8, 2, 15, 7, 7, 'MEM-FEL-EPI7-2026-009', 'Felicitación y reconocimiento por esclarecimiento de caso', 'documentos/memo_fel_009.pdf', '4e07408562bedb8b60ce05c1decfe3ad16b72230967de01f640b7e4729b49fce', '2026-08-15 11:00:00', 6),
        (9, 5, 20, 9, 9, 'DESIG-EPI9-2026-014', 'Designación al cargo de Oficial de Operaciones EPI Merced', 'documentos/desig_014.pdf', '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a', '2026-08-15 15:30:00', 7),
        (10, 4, 2, 1, 1, 'SOL-VAC-EPI1-2026-002', 'Licencia reglamentaria por maternidad / antigüedad', 'documentos/sol_vac_002.pdf', 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d', '2026-08-14 09:00:00', 6),

        -- Trámites Registrados Oficialmente (Flujo Cerrado)
        (11, 2, 5, 2, 2, 'MEM-FEL-EPI2-2026-001', 'Felicitación por servicio extraordinario en control vial', 'documentos/memo_fel_001.pdf', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', '2026-08-10 10:00:00', 8),
        (12, 1, 14, 6, 6, 'MEM-DISC-EPI6-2026-001', 'Memorándum de severa llamada de atención por negligencia', 'documentos/memo_disc_001_c.pdf', 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e', '2026-08-08 16:00:00', 8);
    ");

    // -------------------------------------------------------------
    // 12. VERSIONES DE DOCUMENTOS
    // -------------------------------------------------------------
    echo "-> Insertando Versiones de Documentos...\n";
    $pdo->exec("
        INSERT INTO versiones_documento (id_version, id_documento, version, ruta_pdf, subido_por, fecha) VALUES
        (1, 1, 1, 'documentos/memo_disc_001.pdf', 1, '2026-08-17 08:30:00'),
        (2, 2, 1, 'documentos/memo_fel_004.pdf', 2, '2026-08-17 09:15:00'),
        (3, 3, 1, 'documentos/sol_vac_012.pdf', 3, '2026-08-17 10:00:00'),
        (4, 4, 1, 'documentos/desig_008.pdf', 4, '2026-08-17 10:45:00'),
        (5, 5, 1, 'documentos/perm_019.pdf', 5, '2026-08-17 11:20:00'),
        (6, 6, 1, 'documentos/memo_disc_003.pdf', 6, '2026-08-16 14:00:00'),
        (7, 7, 1, 'documentos/perm_005.pdf', 8, '2026-08-16 16:30:00'),
        (8, 8, 1, 'documentos/memo_fel_009.pdf', 7, '2026-08-15 11:00:00'),
        (9, 9, 1, 'documentos/desig_014.pdf', 9, '2026-08-15 15:30:00'),
        (10, 10, 1, 'documentos/sol_vac_002.pdf', 1, '2026-08-14 09:00:00'),
        (11, 11, 1, 'documentos/memo_fel_001.pdf', 2, '2026-08-10 10:00:00'),
        (12, 12, 1, 'documentos/memo_disc_001_c.pdf', 6, '2026-08-08 16:00:00'),
        (13, 12, 2, 'documentos/memo_disc_001_c_v2.pdf', 6, '2026-08-09 11:00:00');
    ");

    // -------------------------------------------------------------
    // 13. REVISIONES DEL COMANDO DEPARTAMENTAL
    // -------------------------------------------------------------
    echo "-> Insertando Revisiones del Comando Departamental...\n";
    $pdo->exec("
        INSERT INTO revisiones (id_revision, id_documento, usuario_revisor, id_tipo_observacion, nivel_revision, estado, observacion_libre, fecha) VALUES
        (1, 6, 10, 1, 'Comando Departamental La Paz', 'Observado', 'Falta la firma y sello del Comandante de la EPI 6 Chijini en el anverso del documento.', '2026-08-16 15:30:00'),
        (2, 7, 10, 2, 'Comando Departamental La Paz', 'Devuelto', 'La fecha consignada tiene desfase de un mes con respecto a la fecha del servicio.', '2026-08-16 17:15:00'),
        (3, 8, 10, NULL, 'Comando Departamental La Paz', 'Aprobado', 'Revisión formal completada satisfactoriamente. Remitido a Comando General.', '2026-08-15 16:00:00'),
        (4, 9, 10, NULL, 'Comando Departamental La Paz', 'Aprobado', 'Documento conforme a normativa. Cumple con los requisitos de designación.', '2026-08-16 09:30:00'),
        (5, 10, 10, NULL, 'Comando Departamental La Paz', 'Aprobado', 'Aprobado sin observaciones.', '2026-08-14 14:00:00'),
        (6, 11, 10, NULL, 'Comando Departamental La Paz', 'Aprobado', 'Aprobado formalmente.', '2026-08-10 15:00:00'),
        (7, 12, 10, NULL, 'Comando Departamental La Paz', 'Aprobado', 'Subsanación verificada y aprobada.', '2026-08-09 14:30:00');
    ");

    // -------------------------------------------------------------
    // 14. HISTORIAL DE ESTADOS (Trazabilidad)
    // -------------------------------------------------------------
    echo "-> Insertando Historial de Estados...\n";
    $pdo->exec("
        INSERT INTO historial_estados (id_historial, id_documento, estado_anterior, estado_nuevo, usuario, fecha) VALUES
        (1, 1, 1, 2, 1, '2026-08-17 08:30:00'),
        (2, 2, 1, 2, 2, '2026-08-17 09:15:00'),
        (3, 3, 1, 2, 3, '2026-08-17 10:00:00'),
        (4, 3, 2, 3, 10, '2026-08-17 10:30:00'),
        (5, 4, 1, 2, 4, '2026-08-17 10:45:00'),
        (6, 5, 1, 2, 5, '2026-08-17 11:20:00'),
        (7, 6, 1, 2, 6, '2026-08-16 14:00:00'),
        (8, 6, 2, 4, 10, '2026-08-16 15:30:00'),
        (9, 7, 1, 2, 8, '2026-08-16 16:30:00'),
        (10, 7, 2, 5, 10, '2026-08-16 17:15:00'),
        (11, 8, 1, 2, 7, '2026-08-15 11:00:00'),
        (12, 8, 2, 6, 10, '2026-08-15 16:00:00'),
        (13, 9, 1, 2, 9, '2026-08-15 15:30:00'),
        (14, 9, 2, 7, 10, '2026-08-16 09:30:00'),
        (15, 10, 1, 2, 1, '2026-08-14 09:00:00'),
        (16, 10, 2, 6, 10, '2026-08-14 14:00:00'),
        (17, 11, 1, 2, 2, '2026-08-10 10:00:00'),
        (18, 11, 2, 6, 10, '2026-08-10 15:00:00'),
        (19, 11, 6, 8, 11, '2026-08-11 09:30:00'),
        (20, 12, 1, 2, 6, '2026-08-08 16:00:00'),
        (21, 12, 2, 4, 10, '2026-08-09 08:30:00'),
        (22, 12, 4, 2, 6, '2026-08-09 11:00:00'),
        (23, 12, 2, 6, 10, '2026-08-09 14:30:00'),
        (24, 12, 6, 8, 11, '2026-08-09 16:00:00');
    ");

    // -------------------------------------------------------------
    // 15. NOTIFICACIONES
    // -------------------------------------------------------------
    echo "-> Insertando Notificaciones Institucionales...\n";
    $pdo->exec("
        INSERT INTO notificaciones (id_notificacion, id_usuario, id_documento, titulo, mensaje, leido, fecha) VALUES
        (1, 10, 1, 'Nuevo trámite recibido de EPI 1 San Pedro', 'El Secretario de EPI 1 San Pedro remitió el memorándum MEM-DISC-EPI1-2026-001 para revisión.', FALSE, '2026-08-17 08:31:00'),
        (2, 10, 2, 'Nuevo trámite recibido de EPI 2 Sur', 'El Secretario de EPI 2 Sur remitió el trámite MEM-FEL-EPI2-2026-004.', FALSE, '2026-08-17 09:16:00'),
        (3, 6, 6, 'Trámite OBSERVADO por Comando Departamental', 'El memorándum MEM-DISC-EPI6-2026-003 fue devuelto. Motivo: Falta firma y sello del Comandante de EPI 6 Chijini.', FALSE, '2026-08-16 15:31:00'),
        (4, 8, 7, 'Trámite DEVUELTO por Comando Departamental', 'El permiso PERM-EPI8-2026-005 fue observado por fecha incorrecta.', FALSE, '2026-08-16 17:16:00'),
        (5, 11, 8, 'Documento Aprobado por Comando Departamental', 'El Comando Departamental remitió el memorándum aprobado MEM-FEL-EPI7-2026-009.', FALSE, '2026-08-15 16:01:00'),
        (6, 11, 9, 'Documento de Designación Aprobado', 'Se remitió la designación DESIG-EPI9-2026-014 para registro en escalafón.', FALSE, '2026-08-16 09:31:00'),
        (7, 2, 11, 'Trámite REGISTRADO en Comando General', 'El memorándum MEM-FEL-EPI2-2026-001 ha sido registrado formalmente en el sistema oficial.', TRUE, '2026-08-11 09:31:00');
    ");

    // -------------------------------------------------------------
    // 16. SISTEMA EXPERTO: NORMAS, ARTÍCULOS Y REGLAS
    // -------------------------------------------------------------
    echo "-> Insertando Normas y Reglas del Sistema Experto...\n";
    $pdo->exec("
        INSERT INTO normas (id_norma, codigo, nombre, version, vigente, fecha_inicio) VALUES
        (1, 'LEY-101', 'Ley del Régimen Disciplinario de la Policía Boliviana', '1.0', TRUE, '2011-04-04'),
        (2, 'RG-PERS', 'Reglamento de Personal y Escalafón de la Policía Boliviana', '2.1', TRUE, '2018-01-01');

        INSERT INTO articulos (id_articulo, id_norma, numero, titulo, texto) VALUES
        (1, 1, 'Art. 6', 'Faltas Leves', 'Constituyen faltas leves las acciones u omisiones en el cumplimiento del deber que no causen daño grave.'),
        (2, 1, 'Art. 12', 'Formalidades del Memorándum', 'Todo memorándum disciplinario debe contener firma de la autoridad, fecha fidedigna y número correlativo.'),
        (3, 2, 'Art. 24', 'Registro en Escalafón', 'Los reconocimientos y felicitaciones deberán remitirse al Comando General para su homologación.');

        INSERT INTO reglas (id_regla, id_articulo, nombre, descripcion, tipo_documento, observacion_sugerida) VALUES
        (1, 2, 'Verificación de Firma de Autoridad', 'Verifica que el memorándum cuente con la rúbrica formal del comandante de unidad.', 1, 'Falta la firma formal de la autoridad competente en la EPI.'),
        (2, 2, 'Coherencia de Numeración', 'Comprueba que el código del documento mantenga la secuencia anual.', 1, 'El correlativo del memorándum presenta posibles duplicidades o saltos.'),
        (3, 3, 'Homologación de Felicitaciones', 'Regla que guía la remisión de felicitaciones a la Dirección Nacional de Personal.', 2, 'Verificar que la felicitación esté debidamente justificada con el parte diario.');
    ");

    // -------------------------------------------------------------
    // 17. CONFIGURACIÓN
    // -------------------------------------------------------------
    echo "-> Insertando Parámetros de Configuración...\n";
    $pdo->exec("
        INSERT INTO configuracion (nombre, valor) VALUES
        ('TIEMPO_MAXIMO_REVISION_HORAS', '48'),
        ('DEPARTAMENTO_SEDE', 'La Paz'),
        ('TOTAL_EPIS_JURISDICCION', '9'),
        ('VERSION_SISTEMA', '1.0.0-OFBOL');
    ");

    $pdo->commit();

    // Actualizar secuencias de PostgreSQL a los máximos reales
    echo "-> Sincronizando secuencias de IDs en PostgreSQL...\n";
    $tablesPK = [
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

    foreach ($tablesPK as $tbl => $pk) {
        try {
            $stmt = $pdo->prepare("SELECT pg_get_serial_sequence(:tbl, :pk)");
            $stmt->execute(['tbl' => $tbl, 'pk' => $pk]);
            $seq = $stmt->fetchColumn();
            if ($seq) {
                $maxVal = $pdo->query("SELECT COALESCE(MAX($pk), 0) FROM $tbl")->fetchColumn();
                $pdo->exec("SELECT setval('$seq', " . max((int)$maxVal, 1) . ", true)");
            }
        } catch (Exception $e) {}
    }

    echo "===============================================\n";
    echo " ¡SEED EJECUTADO CON ÉXITO EN 'comlapaz'!\n";
    echo "===============================================\n";

    $summary = [
        'Comandos' => 'comando_departamental',
        'Roles' => 'roles',
        'EPIs de La Paz' => 'epis',
        'Usuarios Activos' => 'usuarios',
        'Grados Policiales' => 'grados',
        'Cargos' => 'cargos',
        'Oficiales Registrados' => 'oficiales',
        'Tipos de Documento' => 'tipos_documento',
        'Estados de Documento' => 'estados_documento',
        'Tipos de Observación' => 'tipos_observacion',
        'Documentos de Prueba' => 'documentos',
        'Versiones Documento' => 'versiones_documento',
        'Revisiones C.D.' => 'revisiones',
        'Historial de Estados' => 'historial_estados',
        'Notificaciones' => 'notificaciones',
        'Normas y Reglas' => 'reglas'
    ];

    foreach ($summary as $lbl => $tbl) {
        $count = $pdo->query("SELECT count(*) FROM $tbl")->fetchColumn();
        echo " ✓ $lbl: $count registros\n";
    }

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "ERROR DURANTE EL SEED: " . $e->getMessage() . "\n";
}
