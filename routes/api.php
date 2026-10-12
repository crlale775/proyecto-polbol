<?php

use App\Http\Controllers\ArticuloController;
use App\Http\Controllers\AuditoriaController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CargoController;
use App\Http\Controllers\ComandoDepartamentalController;
use App\Http\Controllers\ConfiguracionController;
use App\Http\Controllers\DocumentoController;
use App\Http\Controllers\EpiController;
use App\Http\Controllers\EstadoDocumentoController;
use App\Http\Controllers\FlujoDocumentoController;
use App\Http\Controllers\GradoController;
use App\Http\Controllers\HistorialDestinoController;
use App\Http\Controllers\HistorialEstadoController;
use App\Http\Controllers\MetricasController;
use App\Http\Controllers\NormaController;
use App\Http\Controllers\NotificacionController;
use App\Http\Controllers\OficialController;
use App\Http\Controllers\PanelController;
use App\Http\Controllers\PlantillaController;
use App\Http\Controllers\RegistroLinkController;
use App\Http\Controllers\ReglaController;
use App\Http\Controllers\RevisionController;
use App\Http\Controllers\RolController;
use App\Http\Controllers\SolicitudRegistroController;
use App\Http\Controllers\SesionController;
use App\Http\Controllers\SincronizacionController;
use App\Http\Controllers\TipoDocumentoController;
use App\Http\Controllers\TipoMemoController;
use App\Http\Controllers\TipoObservacionController;
use App\Http\Controllers\UsuarioController;
use App\Http\Controllers\ValidacionController;
use App\Http\Controllers\VersionDocumentoController;
use Illuminate\Support\Facades\Route;

// Autenticación institucional (verifica contraseña y registra la sesión)
Route::post('login', [AuthController::class, 'login']);

// ===== ESPACIO: REGISTRO DE OFICIALES + VERIFICACIÓN IA =====
// Panel interno: generar y administrar links de registro
Route::get('registro-links', [RegistroLinkController::class, 'index']);
Route::post('registro-links', [RegistroLinkController::class, 'store']);
Route::post('registro-links/{id}/cancelar', [RegistroLinkController::class, 'cancelar']);
// Datos públicos del link para el form externo (sin login)
Route::get('registro-links/publico/{token}', [RegistroLinkController::class, 'publico']);
// Solicitudes: panel interno (listar, detalle, verificar con IA, aprobar, rechazar)
Route::get('solicitudes-registro', [SolicitudRegistroController::class, 'index']);
Route::get('solicitudes-registro/{id}', [SolicitudRegistroController::class, 'show']);
Route::post('solicitudes-registro/{id}/verificar-ia', [SolicitudRegistroController::class, 'verificarIA']);
Route::post('solicitudes-registro/{id}/aprobar', [SolicitudRegistroController::class, 'aprobar']);
Route::post('solicitudes-registro/{id}/rechazar', [SolicitudRegistroController::class, 'rechazar']);
// Formulario PÚBLICO de auto-registro (llega por el link enviado por WhatsApp)
Route::post('registro-publico/{token}', [SolicitudRegistroController::class, 'registrarPublico']);

// Subida física del PDF adjunto (storage/app/public/documentos)
Route::post('upload-documento', [DocumentoController::class, 'subirArchivo']);
// Revisión IA en vivo del PDF antes de registrarlo (Sistema Experto)
Route::post('documentos/revisar-ia', [DocumentoController::class, 'revisarIA']);

// ===== MODO EN VIVO: sincronización entre ventanas abiertas (polling liviano) =====
Route::get('sync/estado', [SincronizacionController::class, 'estado']);
Route::get('sync/ping', [SincronizacionController::class, 'ping']);

// Rutas especializadas para trazabilidad, métricas institucionales y usuarios
Route::get('documentos/{id}/trazabilidad', [DocumentoController::class, 'trazabilidad']);
Route::get('desempenio-epis', [DocumentoController::class, 'desempenioEpis']);
// Paneles de inicio (agregados ligeros, una sola respuesta por rol)
Route::get('panel/unidad', [PanelController::class, 'unidad']);
Route::get('panel/departamental', [PanelController::class, 'departamental']);
Route::get('panel/general', [PanelController::class, 'general']);
Route::get('estadisticas-generales', [DocumentoController::class, 'estadisticasGenerales']);
Route::get('metricas/reportes', [MetricasController::class, 'reportes']);
Route::post('usuarios/{id}/reset-password', [UsuarioController::class, 'resetPassword']);
Route::post('upload-foto', [UsuarioController::class, 'subirFoto']);

// Rutas API para los 25 controladores basados en la base de datos
Route::apiResource('roles', RolController::class);
Route::apiResource('comando-departamental', ComandoDepartamentalController::class);
Route::apiResource('epis', EpiController::class);
Route::apiResource('usuarios', UsuarioController::class);
Route::apiResource('sesiones', SesionController::class);
Route::apiResource('auditorias', AuditoriaController::class);
Route::apiResource('cargos', CargoController::class);
Route::apiResource('grados', GradoController::class);
Route::apiResource('oficiales', OficialController::class);
Route::apiResource('historial-destinos', HistorialDestinoController::class);
Route::apiResource('tipos-documento', TipoDocumentoController::class);
// Catálogo de tipos de memorándum con formato y validaciones (Comando General)
Route::apiResource('tipos-memo', TipoMemoController::class);
Route::apiResource('estados-documento', EstadoDocumentoController::class);
Route::apiResource('tipos-observacion', TipoObservacionController::class);
Route::apiResource('plantillas', PlantillaController::class);
Route::apiResource('configuraciones', ConfiguracionController::class);
Route::apiResource('documentos', DocumentoController::class);
Route::apiResource('versiones-documento', VersionDocumentoController::class);
Route::apiResource('revisiones', RevisionController::class);
Route::apiResource('normas', NormaController::class);
Route::apiResource('articulos', ArticuloController::class);
Route::apiResource('reglas', ReglaController::class);
Route::apiResource('validaciones', ValidacionController::class);
Route::apiResource('flujo-documentos', FlujoDocumentoController::class);
Route::apiResource('historial-estados', HistorialEstadoController::class);
Route::apiResource('notificaciones', NotificacionController::class);
