<?php

/**
 * OFBOL — Instalador del ESPACIO DE REGISTRO DE OFICIALES Y VERIFICACIÓN IA
 * Crea (si no existen) las tablas links_registro y solicitudes_registro,
 * con sus índices y claves foráneas. Es IDEMPOTENTE (puede ejecutarse varias veces).
 *
 * Uso: php database/install_registro_ia.php
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
    echo "Conectado a: $dbname\n";

    // -------------------------------------------------------------
    // 1. LINKS DE REGISTRO (generados por el panel interno, ej. Comando General)
    // -------------------------------------------------------------
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS links_registro (
            id_link SERIAL PRIMARY KEY,
            token VARCHAR(64) NOT NULL UNIQUE,
            id_rol INT NOT NULL,
            id_epi INT,
            id_usuario_emisor INT,
            estado VARCHAR(20) NOT NULL DEFAULT 'activo',   -- activo | usado | cancelado
            fecha_expiracion TIMESTAMP WITHOUT TIME ZONE,
            creado_en TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    ");
    $pdo->exec("ALTER TABLE links_registro DROP CONSTRAINT IF EXISTS fk_links_registro_roles");
    $pdo->exec("ALTER TABLE links_registro DROP CONSTRAINT IF EXISTS fk_links_registro_epis");
    $pdo->exec("ALTER TABLE links_registro DROP CONSTRAINT IF EXISTS fk_links_registro_usuarios");
    $pdo->exec("ALTER TABLE links_registro ADD CONSTRAINT fk_links_registro_roles FOREIGN KEY (id_rol) REFERENCES roles(id_rol) ON UPDATE CASCADE ON DELETE RESTRICT");
    $pdo->exec("ALTER TABLE links_registro ADD CONSTRAINT fk_links_registro_epis FOREIGN KEY (id_epi) REFERENCES epis(id_epi) ON UPDATE CASCADE ON DELETE SET NULL");
    $pdo->exec("ALTER TABLE links_registro ADD CONSTRAINT fk_links_registro_usuarios FOREIGN KEY (id_usuario_emisor) REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE SET NULL");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_links_registro_token ON links_registro(token)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_links_registro_estado ON links_registro(estado)");
    echo "  ✓ tabla links_registro lista\n";

    // -------------------------------------------------------------
    // 2. SOLICITUDES DE REGISTRO (llenadas desde el form público)
    // -------------------------------------------------------------
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS solicitudes_registro (
            id_solicitud BIGSERIAL PRIMARY KEY,
            id_link INT NOT NULL,
            token VARCHAR(64) NOT NULL,
            id_rol INT NOT NULL,
            id_epi INT,
            nombres VARCHAR(100) NOT NULL,
            apellidos VARCHAR(100) NOT NULL,
            ci VARCHAR(20),
            telefono VARCHAR(25) NOT NULL,
            usuario VARCHAR(50) NOT NULL UNIQUE,
            ruta_memo VARCHAR(500) NOT NULL,
            hash_memo VARCHAR(64),
            estado_solicitud VARCHAR(25) NOT NULL DEFAULT 'recibida',  -- recibida | verificada | aprobada | rechazada
            ia_estado VARCHAR(25) NOT NULL DEFAULT 'pendiente',        -- pendiente | procesada | error
            ia_firma BOOLEAN,
            ia_sello BOOLEAN,
            ia_nombres TEXT,
            ia_coincide BOOLEAN,
            ia_advertencia BOOLEAN,
            ia_mensaje TEXT,
            observacion TEXT,
            id_usuario_creado INT,
            creado_en TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            ia_verificado_en TIMESTAMP WITHOUT TIME ZONE,
            resuelto_en TIMESTAMP WITHOUT TIME ZONE
        );
    ");
    $pdo->exec("ALTER TABLE solicitudes_registro DROP CONSTRAINT IF EXISTS fk_solicitudes_registro_links");
    $pdo->exec("ALTER TABLE solicitudes_registro DROP CONSTRAINT IF EXISTS fk_solicitudes_registro_roles");
    $pdo->exec("ALTER TABLE solicitudes_registro DROP CONSTRAINT IF EXISTS fk_solicitudes_registro_epis");
    $pdo->exec("ALTER TABLE solicitudes_registro DROP CONSTRAINT IF EXISTS fk_solicitudes_registro_usuarios");
    $pdo->exec("ALTER TABLE solicitudes_registro ADD CONSTRAINT fk_solicitudes_registro_links FOREIGN KEY (id_link) REFERENCES links_registro(id_link) ON UPDATE CASCADE ON DELETE CASCADE");
    $pdo->exec("ALTER TABLE solicitudes_registro ADD CONSTRAINT fk_solicitudes_registro_roles FOREIGN KEY (id_rol) REFERENCES roles(id_rol) ON UPDATE CASCADE ON DELETE RESTRICT");
    $pdo->exec("ALTER TABLE solicitudes_registro ADD CONSTRAINT fk_solicitudes_registro_epis FOREIGN KEY (id_epi) REFERENCES epis(id_epi) ON UPDATE CASCADE ON DELETE SET NULL");
    $pdo->exec("ALTER TABLE solicitudes_registro ADD CONSTRAINT fk_solicitudes_registro_usuarios FOREIGN KEY (id_usuario_creado) REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE SET NULL");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_solicitudes_registro_token ON solicitudes_registro(token)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_solicitudes_registro_estado ON solicitudes_registro(estado_solicitud)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_solicitudes_registro_ia_adv ON solicitudes_registro(ia_advertencia)");
    echo "  ✓ tabla solicitudes_registro lista\n";

    // -------------------------------------------------------------
    // 2b. FOTO DE PERFIL + VERIFICACIÓN DE ROSTRO (IA) + COLA FIFO
    //     (idempotente: agrega columnas solo si no existen)
    // -------------------------------------------------------------
    $columnaExiste = function (string $tabla, string $columna) use ($pdo): bool {
        $q = $pdo->prepare("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ? AND column_name = ?");
        $q->execute([$tabla, $columna]);
        return ((int) $q->fetchColumn()) > 0;
    };

    if (!$columnaExiste('solicitudes_registro', 'ruta_foto')) {
        $pdo->exec("ALTER TABLE solicitudes_registro ADD COLUMN ruta_foto VARCHAR(500)");
        echo "  ✓ columna solicitudes_registro.ruta_foto agregada\n";
    }
    if (!$columnaExiste('solicitudes_registro', 'ia_rostro')) {
        $pdo->exec("ALTER TABLE solicitudes_registro ADD COLUMN ia_rostro BOOLEAN");
        echo "  ✓ columna solicitudes_registro.ia_rostro agregada\n";
    }
    echo "  ✓ columnas de foto/rostro listas\n";

    // -------------------------------------------------------------
    // 3. Directorio de almacenamiento de memorándums de designación
    //     y fotos de perfil
    // -------------------------------------------------------------
    foreach (['solicitudes', 'solicitudes/fotos'] as $sub) {
        $dir = __DIR__ . '/../storage/app/public/' . $sub;
        if (!is_dir($dir)) {
            mkdir($dir, 0777, true);
            echo "  ✓ carpeta storage/app/public/$sub creada\n";
        } else {
            echo "  - carpeta storage/app/public/$sub ya existe\n";
        }
    }

    echo "===============================================\n";
    echo " ¡ESPACIO DE REGISTRO IA INSTALADO CON ÉXITO!\n";
    echo "===============================================\n";

} catch (Exception $e) {
    echo 'ERROR: ' . $e->getMessage() . "\n";
}
