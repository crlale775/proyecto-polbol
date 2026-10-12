# Sistema Experto - Documentación

## Descripción

El "Sistema Experto" es el componente de IA local (integrado con LM Studio) encargado de la verificación automática y análisis documental de memorándums en el sistema OFBOL.

## Archivos Backend Relacionados

### Servicios (Core del Sistema Experto)
- `app/Services/VerificadorIA.php` - Cliente principal para la IA local (LM Studio). Implementa análisis de documentos PDF/imágenes, verificación de firma/sello/destinatario.
- `app/Services/ColaVerificacionIA.php` - Cola FIFO para procesamiento asíncrono de verificaciones IA.
- `app/Services/PdfPaginas.php` - Extracción y conversión de páginas PDF a imágenes para análisis con visión IA.

### Controladores
- `app/Http/Controllers/DocumentoController.php` - Endpoint `revisarIA()` para revisión en vivo del PDF antes de registrarlo.
- `app/Http/Controllers/SolicitudRegistroController.php` - Verificación IA en solicitudes de registro público.

### Configuración y Comandos
- `config/ia.php` - **Parámetros principales** para la IA local conectada a LM Studio.
- `app/Console/Commands/VerificarColaIA.php` - Worker para procesar la cola de verificaciones.

## Parámetros para IA Local (LM Studio)

Estos son los parámetros críticos que debe revisar/configurar la IA local conectada a LM Studio. Definidos en `.env` y leídos desde `config/ia.php`:

| Parámetro | Variable .env | Valor por defecto | Descripción |
|---|---|---|---|
| URL Base | `IA_URL` | `http://127.0.0.1:1234` | URL del servidor LM Studio (OpenAI compatible) |
| Endpoint | `IA_ENDPOINT` | `/api/v1/chat` | Endpoint de chat completions |
| Modelo | `IA_MODEL` | `qwen/qwen2.5-vl-7b` | Modelo de visión único (Q4_K_M recomendado, ~6GB VRAM) |
| Timeout | `IA_TIMEOUT` | `120` | Timeout para solicitudes (segundos) |
| Timeout rápido | `IA_TIMEOUT_RAPIDO` | `60` | Timeout para revisión en vivo (módulo Subir Documento) |
| DPI | `IA_DPI` | `120` | Resolución para imágenes (reduce tokens vs 150 DPI) |
| DPI rápido | `IA_DPI_RAPIDO` | `96` | Resolución para revisión rápida (menos tokens, más veloz) |
| Máx. Páginas | `IA_MAX_PAGINAS` | `1` | Máximo de páginas a analizar |
| Lote Cola | `IA_COLA_LOTE` | `10` | Solicitudes por ejecución del worker |
| Pausa Cola | `IA_COLA_PAUSA` | `3` | Segundos de pausa cuando cola vacía |

### Notas importantes para LM Studio
- **Modelo único**: Usar `qwen/qwen2.5-vl-7b` cargado en memoria (evitar intercambio de modelos - causa lentitud).
- **GPU Offload**: Máximo posible (con 4GB VRAM ajustar a 24-32 capas si hay memoria insuficiente).
- **Flash Attention**: ON
- **Context Length**: 8192 es suficiente (16384 no acelera significativamente)
- **Parallel Requests**: 1 (una sola consulta a la vez)
- **Keep model in memory**: ON
- **Speculative decoding**: OFF en equipos con 4GB VRAM

## Rutas API Relacionadas

### Revisión IA en vivo (Subir Documento)
```php
Route::post('documentos/revisar-ia', [DocumentoController::class, 'revisarIA']);
```

### Verificación IA en Solicitudes de Registro
```php
Route::post('solicitudes-registro/{id}/verificar-ia', [SolicitudRegistroController::class, 'verificarIA']);
Route::post('registro-publico/{token}', [SolicitudRegistroController::class, 'registrarPublico']);
```

### Worker de Cola (CLI)
```bash
php artisan ia:procesar-cola
```

## Archivos Frontend que Referencian el Sistema Experto

Estos archivos contienen la lógica de UI para interactuar con el Sistema Experto:

- `resources/views/secretario_unidad/SubirDocumento.jsx` - Panel de revisión preventiva del Sistema Experto al subir documentos.
- `resources/views/secretario_unidad/Correcciones.jsx` - Vista de correcciones con diagnóstico del Sistema Experto y checklist ordenado por urgencia.

**Nota**: Estos archivos permanecen en su ubicación actual por mantener una reestructuración mínima.
