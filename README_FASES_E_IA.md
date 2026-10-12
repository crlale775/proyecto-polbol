# OFBOL — Guía de las 10 fases y de la IA local (LM Studio)

Este documento responde dos preguntas, fase por fase:

1. **¿En qué lugar del sistema vive cada una de las 10 fases** del aporte ingenieril (adquisición del conocimiento → validación)?
2. **¿Dónde manda el sistema a la IA local lo que tiene que revisar** y qué le envía exactamente?

> Proyecto: **OFBOL** — Gestión de memorándums de la Policía Boliviana (Laragon / PostgreSQL).
> Backend: **Laravel 13 (PHP 8.3)** · Frontend: **React 19 SPA (Vite + Tailwind)** · BD: **PostgreSQL**.
> IA local: **LM Studio** en `http://127.0.0.1:1234` con el modelo de visión **qwen/qwen2.5-vl-7b**.

---

## 1. Respuesta corta: las 10 fases y su lugar en el sistema

| # | Fase (según el documento) | Dónde vive en el sistema | ¿Usa la IA local? |
|---|---------------------------|--------------------------|-------------------|
| 1 | Adquisición del conocimiento | Tablas `normas` y `articulos` (carga en `ulla.sql`) | No |
| 2 | Identificación de requisitos | `tipos_memo.validaciones` (JSONB) por cada tipo | No |
| 3 | Clasificación y estructuración | Tablas `tipos_documento`, `tipos_memo`, `normas`, `articulos`, `reglas`, `validaciones` | No |
| 4 | Depuración del conocimiento | Contenido de `reglas` (solo 3) y criterios en `TiposMemoSeeder.php` | No |
| 5 | Formalización | Tabla `reglas` (condición → conclusión → artículo de origen) | No |
| 6 | Construcción de la base de conocimiento | `TiposMemoSeeder.php`, migración de `tipos_memo`, `install_registro_ia.php`, pantalla `GestionTiposMemo.jsx` | No (guarda la configuración que la IA aplica) |
| 7 | **Motor de inferencia** | `app/Services/VerificadorIA.php` + reglas del panel en `SubirDocumento.jsx` | **SÍ — LM Studio** |
| 8 | **Ejecución de la inferencia** | Pantalla `/secretario/subir-documento` → `POST /api/documentos/revisar-ia` | **SÍ — `revisarRapido()`** |
| 9 | Verificación | Consultas de solo lectura a `normas`/`articulos`/`reglas` + suite de pruebas `tests/` | No |
| 10 | Validación | Cola departamental `RevisarDocumentos.jsx`, bandeja general `DocumentosAprobados.jsx`, `tests/` | No (consume resultados) |

> Además del flujo principal, la fase 7 tiene un **segundo camino de IA**: el **registro público de oficiales** (memo de designación + foto de perfil) que se verifica solo por una **cola FIFO** (ver sección 4).

---

## 2. Los dos puntos donde el sistema llama a la IA local

Todo el contacto con LM Studio pasa por **una sola clase cliente**: `app/Services/VerificadorIA.php`.
Esa clase se invoca desde **dos lugares**:

| Punto de entrada | Se dispara cuando… | Ruta / método | Método del verificador |
|---|---|---|---|
| **A. Revisión en vivo** (Subir Documento) | El Secretario de EPI adjunta el PDF | `POST /api/documentos/revisar-ia` → `DocumentoController::revisarIA()` (`app/Http/Controllers/DocumentoController.php:177`) | `VerificadorIA::revisarRapido()` |
| **B. Registro público** (memo de designación + foto) | Un oficial llena el formulario del link de WhatsApp | `POST /api/registro-publico/{token}` → `SolicitudRegistroController::registrarPublico()` (`app/Http/Controllers/SolicitudRegistroController.php:61`), que encola y despacha el worker | `VerificadorIA::analizar()` y `analizarRostro()` |

### 2.1 La llamada HTTP final (dónde sale el paquete hacia la IA)

El único punto donde el sistema hace la petición de red está en
**`app/Services/VerificadorIA.php:445`** (método `consultar()`):

```php
// app/Services/VerificadorIA.php  (método consultar(), ~línea 445)
$endpoint = $this->url() . '/' . ltrim((string) config('ia.endpoint', '/api/v1/chat'), '/');
$response = Http::timeout(...)->asJson()->post($endpoint, [
    'model'       => $modelo ?? (string) config('ia.model'),
    'temperature' => 0,
    'input'       => $input,   // [ {type:text,...}, {type:image, data_url:...}, ... ]
]);
```

Equivale a:

```
POST http://127.0.0.1:1234/api/v1/chat
Content-Type: application/json

{
  "model": "qwen/qwen2.5-vl-7b",
  "temperature": 0,
  "input": [
    { "type": "text",  "content": "<instrucciones + JSON esperado>" },
    { "type": "image", "data_url": "data:image/png;base64,<página del PDF>" }
  ]
}
```

La respuesta se lee de `output[].content` (mismo método `consultar()`).

### 2.2 Qué se le envía a la IA para revisar (contenido del prompt)

**A. `revisarRapido()`** — revisión en vivo, **1 imagen de la 1.ª página** y **1 sola consulta**.
Pide en JSON: `es_memo`, `tipo_memo`, `destinatario`, `fecha_documento`, `firma`, `sello`, `resumen`.

**B. `analizar()`** — registro público:
- **Nombres:** pide **copia verbatim** del bloque destinatario ("Al Señor(a): … Presente.-"); la identidad **se decide localmente** comparando el nombre copiado con el registrado (a la IA no se le dice el nombre esperado).
- **Firma/sello:** consulta sobre la página completa y, si falta algo, sobre los cuadrantes 2×2.
- **Rostro:** `analizarRostro()` manda la foto de perfil y pide `{ "rostro": true|false }`.

### 2.3 Configuración (dónde se define la IA)

| Variable | Valor | Archivo |
|---|---|---|
| `IA_URL` | `http://127.0.0.1:1234` | `.env` / `.env.example` |
| `IA_ENDPOINT` | `/api/v1/chat` | `.env` |
| `IA_MODEL` | `qwen/qwen2.5-vl-7b` | `.env` |
| `IA_DPI` / `IA_MAX_PAGINAS` | `150` / `1` | `.env` |
| `IA_DPI_RAPIDO` / `IA_TIMEOUT_RAPIDO` | `96` / `60` | `.env` |
| `IA_COLA_LOTE` / `IA_COLA_PAUSA` | `10` / `3` | `.env` |

`config/ia.php` es el que lee esas variables (la clase `VerificadorIA` usa `config('ia.*')`).
La conversión **PDF → imágenes PNG** la hace `app/Services/PdfPaginas.php`, que llama al
script `database/render_pdf.py` (PyMuPDF; con respaldo Ghostscript/Poppler).

---

## 3. Detalle fase por fase (dónde está cada una en el sistema)

### Fase 1 — Adquisición del conocimiento
Recolección de normativa (Ley del Régimen Disciplinario **LEY-101**, Reglamento de Personal
y Escalafón **RG-PERS**) y entrevistas a oficiales.

- **Base de datos:** tablas `normas` (2 registros) y `articulos` (3 registros) — ver `ulla.sql`.
- **Modelos:** `app/Models/Norma.php`, `app/Models/Articulo.php`.
- **Controladores / API:** `NormaController.php` (`/api/normas`), `ArticuloController.php` (`/api/articulos`).
- **IA local:** no participa.

### Fase 2 — Identificación de requisitos
Campos obligatorios, palabras clave, longitud mínima y exigencia de firma/sello por tipo de memorándum
(60 campos, 24 palabras clave, 5 tipos).

- **Base de datos:** columna **`tipos_memo.validaciones`** (JSONB) → `campos_requeridos`, `palabras_clave`,
  `longitud_minima` (400), `requiere_firma`, `requiere_sello`.
- **Se cargan en:** `database/seeders/TiposMemoSeeder.php`.
- **Modelo/API:** `app/Models/TipoMemo.php`, `TipoMemoController.php` (`/api/tipos-memo`).
- **IA local:** no participa.

### Fase 3 — Clasificación y estructuración
Agrupación de los requisitos en las tablas que sostienen la base de conocimiento y que hacen
**trazable** cada conclusión hasta su artículo.

- **Tablas:** `tipos_documento` (6), `tipos_memo` (5), `normas` (2), `articulos` (3), `reglas` (3), `validaciones` (0).
- **Migración:** `database/migrations/2026_09_11_000000_create_tipos_memo_table.php`.
- **Esquema completo de referencia:** `ulla.sql`.
- **IA local:** no participa.

### Fase 4 — Depuración del conocimiento
Se descartan ambigüedades y se declara fuera del alcance lo no automatizable
(p. ej. **Artículo 6, faltas leves** → requiere criterio de un oficial).

- **Dónde se refleja:** en el contenido final de `reglas` (solo 3 reglas) y en los criterios de
  `database/seeders/TiposMemoSeeder.php`. No existe una tabla de "exclusiones": la depuración es una
  decisión de diseño documentada (Tabla 10 del documento).
- **IA local:** no participa.

### Fase 5 — Formalización
Los requisitos depurados se transforman en **reglas de producción** (SI condición ENTONCES conclusión)
con el artículo normativo de origen.

- **Tabla:** `reglas` → `id_articulo`, `nombre`, `descripcion`, `tipo_documento`, `observacion_sugerida`.
- **Modelo/API:** `app/Models/Regla.php`, `ReglaController.php` (`/api/reglas`).
- **Trazabilidad del resultado:** tabla `validaciones` (`id_regla` → `resultado`, `mensaje`),
  modelo `app/Models/Validacion.php`, `ValidacionController.php` (`/api/validaciones`).
- **IA local:** no participa.

### Fase 6 — Construcción de la base de conocimiento
Registro efectivo en PostgreSQL (tipos de memorándum con su patrón, normas, artículos y reglas).

- **Carga/siembra:** `database/seeders/TiposMemoSeeder.php`, migración de `tipos_memo`,
  e `database/install_registro_ia.php` (crea `links_registro`, `solicitudes_registro` y columnas `ia_*`).
- **Pantalla de registro (Figura 3 del documento):** `resources/views/comando_general/GestionTiposMemo.jsx`
  (ruta `/comando-general/tipos-memo`, consume `/api/tipos-memo`).
- **IA local:** no escribe en la IA, pero esta base es la **configuración que la IA y el motor aplican**.

### Fase 7 — Motor de inferencia  ⟵ aquí vive la IA local
El motor evalúa las condiciones y activa las reglas (encadenamiento hacia adelante). Se compone de dos partes:

1. **Motor de reglas / heurísticas del sistema experto**
   - **Cliente (React):** reglas del panel "Sistema Experto" en
     `resources/views/secretario_unidad/SubirDocumento.jsx` (Regla 1 oficial, Regla 2 tipo+código,
     Regla 3 referencia, Regla 4 archivo/PDF/membrete).
   - **Servidor (Laravel):** `DocumentoController::revisarIA()`.
2. **Modelo de visión local (la IA que lee firma, sello y nombres)**
   - **Cliente de IA:** `app/Services/VerificadorIA.php`.
   - **Servidor:** LM Studio → `http://127.0.0.1:1234`, modelo `qwen/qwen2.5-vl-7b`, `temperature 0`.
   - **Métodos:** `revisarRapido()` (línea 849 del servicio), `analizar()` (línea 80), `analizarRostro()` (línea 1048).

### Fase 8 — Ejecución de la inferencia  ⟵ aquí se le manda el PDF a la IA
Se ejecuta cuando el Secretario de EPI carga el memorándum.

- **Pantalla:** `/secretario/subir-documento` → `resources/views/secretario_unidad/SubirDocumento.jsx`.
- **Disparo de la IA:** al adjuntar el PDF (con *debounce* de 700 ms) el front llama a
  **`api.upload('/documentos/revisar-ia', fd)`** → `DocumentoController::revisarIA()`
  (`DocumentoController.php:177`) → `VerificadorIA::revisarRapido()`.
- **Qué viaja:** el archivo PDF + `tipo_esperado` y `oficial_esperado`.
- **Dónde se ve el resultado:** el panel **"Verificación del Documento"** de `SubirDocumento.jsx`
  muestra alertas, advertencias y validaciones superadas.
- **Registro definitivo:** al confirmar, el front llama a `/api/upload-documento`, `/api/documentos`,
  `/api/versiones-documento` y `/api/auditorias`.
- **Datos de entrada (Tabla 12):** oficial responsable, tipo de memorándum, código/referencia,
  fecha y **archivo PDF**.

### Fase 9 — Verificación
Comprobaciones de **solo lectura** de que la base de conocimiento se construyó de forma coherente y
completa (integridad referencial, trazabilidad normativa, consistencia, redundancia, reglas inalcanzables).

- **Dónde se ejecuta:** consultas de solo lectura sobre `normas` / `articulos` / `reglas`
  (endpoints `GET` de `NormaController`, `ArticuloController`, `ReglaController`).
- **Pruebas de caja blanca:** suite en `tests/` (`tests/Feature`, `tests/Unit`, `phpunit.xml`)
  → `php artisan test`.
- **IA local:** no participa (solo se verifican los datos que la IA alimenta).

### Fase 10 — Validación
Casos de prueba representativos + revisión experta; las instancias que **consumen** el resultado.

- **Cola de revisión del Comando Departamental (Figura 7):**
  `resources/views/secretario_comando_departamental/RevisarDocumentos.jsx`
  (ruta `/comando-departamental/revision`; usa `PUT /api/documentos`, `POST /api/revisiones`, `POST /api/notificaciones`).
- **Bandeja del Comando General (Figura 8):**
  `resources/views/comando_general/DocumentosAprobados.jsx`
  (ruta `/comando-general/documentos`; confirmar recepción = cierre formal del flujo).
- **Pruebas:** mismos casos de la suite `tests/` (indicador CCR).
- **IA local:** no participa; consume y continúa el flujo institucional.

---

## 4. El flujo de IA del registro público (cola FIFO) — mapa de archivos

Este camino también usa el modelo de visión (fase 7) y conviene tenerlo ubicado:

```
Oficial abre el link (WhatsApp)
        |  resources/views/publico/RegistroOficial.jsx
        v
POST /api/registro-publico/{token}            routes/api.php:54
        |  SolicitudRegistroController::registrarPublico()   <- app/Http/Controllers/SolicitudRegistroController.php:61
        |   - guarda memo PDF + foto, crea la cuenta inactiva
        |   - ia_estado = 'en_cola'
        |   - despacharWorker()  ->  "php artisan ia:procesar-cola"   (linea 312)
        v
Worker de cola                                app/Console/Commands/VerificarColaIA.php
        |  (SELECT ... FOR UPDATE SKIP LOCKED  -> toma la solicitud)
        v
ColaVerificacionIA::procesar()                app/Services/ColaVerificacionIA.php:105
        |   +- analizarMemo()    -> VerificadorIA::analizar()          (firma, sello, nombres)
        |   +- analizarRostro()  -> VerificadorIA::analizarRostro()    (foto de perfil)
        |   guarda ia_firma, ia_sello, ia_nombres, ia_coincide, ia_rostro, ia_advertencia...
        v
Panel interno  /comando-general/registro-oficiales
   resources/views/comando_general/RegistroOficialesIA.jsx
   - re-verificar:  POST /api/solicitudes-registro/{id}/verificar-ia   (routes/api.php:50)
   - aprobar:       POST /api/solicitudes-registro/{id}/aprobar
```

- **Worker:** `php artisan ia:procesar-cola` (una pasada) o `php artisan ia:procesar-cola --daemon` (continuo).
- **Modelo cargado en LM Studio:** `freebuf/lmstudio_load_model.py` / `freebuf/lmstudio_load_model.bat`
  (deja **una sola instancia** de `qwen/qwen2.5-vl-7b`, `context_length 16384`, `parallel 1`, flash-attention).

---

## 5. Tabla resumen de archivos clave de la IA

| Función | Archivo |
|---|---|
| Cliente de la IA local (todo el contacto con LM Studio) | `app/Services/VerificadorIA.php` |
| PDF -> imágenes PNG para la visión | `app/Services/PdfPaginas.php` + `database/render_pdf.py` |
| Cola FIFO de verificación | `app/Services/ColaVerificacionIA.php` |
| Comando worker de la cola | `app/Console/Commands/VerificarColaIA.php` |
| Revisión en vivo (subir documento) | `app/Http/Controllers/DocumentoController.php:177` |
| Registro público + despacho del worker | `app/Http/Controllers/SolicitudRegistroController.php:61` |
| Configuración de la IA | `config/ia.php` · `.env` (`IA_*`) |
| Panel en vivo (frontend) | `resources/views/secretario_unidad/SubirDocumento.jsx` |
| Formulario público (frontend) | `resources/views/publico/RegistroOficial.jsx` |
| Panel de solicitudes + IA (frontend) | `resources/views/comando_general/RegistroOficialesIA.jsx` |
| Carga del modelo en LM Studio | `freebuf/lmstudio_load_model.py` / `.bat` |

---

## 6. Cómo comprobar que la IA está disponible

```bash
# 1. LM Studio debe estar arriba y con el modelo cargado en 127.0.0.1:1234
#    (opcional, reaplica la config óptima del modelo):
python freebuf/lmstudio_load_model.py --espera 300

# 2. El sistema considera la IA "disponible" si IA_URL e IA_MODEL están definidos:
#    VerificadorIA::disponible()  (app/Services/VerificadorIA.php:63)

# 3. Procesar la cola del registro público (una pasada):
php artisan ia:procesar-cola
```

> La verificación se hace **en el equipo institucional**: la documentación **no se envía a ningún
> servicio externo**; solo se consulta al servidor local de LM Studio.
