# Walkthrough — Módulo Secretario EPI

Se ha completado el desarrollo del módulo del **Secretario EPI** dentro de la carpeta `resources/views/secretario_unidad/` con arquitectura sencilla y conexión directa a los controladores de Laravel.

## Componentes y Vistas Creadas

### 1. Vista de Autenticación (`resources/views/auth/`)
- [Login.jsx](file:///c:/laragon/www/ofbol/resources/views/auth/Login.jsx): Pantalla de ingreso institucional independiente de los 3 roles, con validación de credenciales contra `api/usuarios`, carga de EPI/Rol y redirección automática al módulo correspondiente según el rol del usuario autenticado.

### 2. Vistas del Secretario de Unidad (`resources/views/secretario_unidad/`)
- [Dashboard.jsx](file:///c:/laragon/www/ofbol/resources/views/secretario_unidad/Dashboard.jsx): Métricas de la EPI, tabla de documentos recientes, accesos rápidos y panel de avisos.
- [SubirDocumento.jsx](file:///c:/laragon/www/ofbol/resources/views/secretario_unidad/SubirDocumento.jsx): Formulario de registro de documento físico con buscador de oficiales, carga de PDF con hash SHA-256 criptográfico, y motor preventivo del Sistema Experto.
- [MisDocumentos.jsx](file:///c:/laragon/www/ofbol/resources/views/secretario_unidad/MisDocumentos.jsx): Listado con búsqueda, filtros, visor modal y estado de trámites.
- [Historial.jsx](file:///c:/laragon/www/ofbol/resources/views/secretario_unidad/Historial.jsx): Timeline de trazabilidad de la EPI.
- [Reportes.jsx](file:///c:/laragon/www/ofbol/resources/views/secretario_unidad/Reportes.jsx): Reportes y estadísticas por estado, tipo de memorándum y fechas de la EPI.
- [Notificaciones.jsx](file:///c:/laragon/www/ofbol/resources/views/secretario_unidad/Notificaciones.jsx): Bandeja de avisos con marcado como leída.
- [Perfil.jsx](file:///c:/laragon/www/ofbol/resources/views/secretario_unidad/Perfil.jsx): Ficha de perfil institucional del usuario autenticado.

### 3. Vistas del Comando Departamental de La Paz (`resources/views/secretario_comando_departamental/`)
- [Dashboard.jsx](file:///c:/laragon/www/ofbol/resources/views/secretario_comando_departamental/Dashboard.jsx): Métricas consolidadas (recibidos hoy, pendientes, observados, aprobados, tiempo promedio de 1h 45m), distribución y control de las 9 EPIs de La Paz y últimos trámites con desglose de Secretario y su EPI específica.
- [RevisarDocumentos.jsx](file:///c:/laragon/www/ofbol/resources/views/secretario_comando_departamental/RevisarDocumentos.jsx): Cola de trabajo con 4 pestañas (📥 Pendientes, ⚠️ Con observaciones, 🔄 Reenviados, ✅ Aprobados), buscador multifiltro, visor de PDF original no editable, y dictámenes:
  - **Aprobar**: Remisión automática al Comando General.
  - **Observar**: Selección de motivos predefinidos (Falta firma, Fecha incorrecta, No coincide número, PDF ilegible, Documento incompleto) y devolución automática al Secretario de la EPI.
  - **Descargar**: Descarga directa del PDF.
- [Observaciones.jsx](file:///c:/laragon/www/ofbol/resources/views/secretario_comando_departamental/Observaciones.jsx): Bandeja de control y seguimiento de documentos devueltos a las 9 EPIs.
- [Historial.jsx](file:///c:/laragon/www/ofbol/resources/views/secretario_comando_departamental/Historial.jsx): Trazabilidad institucional en cascada (EPI &rarr; Subido &rarr; Observado &rarr; Corregido &rarr; Reenviado &rarr; Aprobado &rarr; Comando General con fecha, usuario y EPI).
- [Reportes.jsx](file:///c:/laragon/www/ofbol/resources/views/secretario_comando_departamental/Reportes.jsx): Reportes y estadísticas comparativas por EPI, tipo de memorándum y rango de fechas.
- [Notificaciones.jsx](file:///c:/laragon/www/ofbol/resources/views/secretario_comando_departamental/Notificaciones.jsx): Alertas de nuevos trámites, subsanaciones y reenvíos.
- [Perfil.jsx](file:///c:/laragon/www/ofbol/resources/views/secretario_comando_departamental/Perfil.jsx): Datos institucionales del revisor departamental.

### 4. Vistas del Comando General de la Policía Boliviana (`resources/views/comando_general/`)
- [Dashboard.jsx](file:///c:/laragon/www/ofbol/resources/views/comando_general/Dashboard.jsx): Indicadores generales de destino final (recibidos hoy, total recibidos, distribución por las 9 EPIs de La Paz, distribución por tipo de memorándum y pendientes de registrar).
- [DocumentosAprobados.jsx](file:///c:/laragon/www/ofbol/resources/views/comando_general/DocumentosAprobados.jsx): Bandeja de entrada oficial con visor de PDF original intacto (sin marcas, sin QR adicional, sin modificaciones), descarga de copia oficial y acción de **Confirmar Recepción y Marcar como Registrado** (cierre formal del flujo).
- [Historial.jsx](file:///c:/laragon/www/ofbol/resources/views/comando_general/Historial.jsx): Cadena de custodia institucional de 10 etapas con fechas, usuarios y entidades.
- [Reportes.jsx](file:///c:/laragon/www/ofbol/resources/views/comando_general/Reportes.jsx): Cifras consolidadas, trámites registrados vs pendientes y comparativas por fechas.
- [Notificaciones.jsx](file:///c:/laragon/www/ofbol/resources/views/comando_general/Notificaciones.jsx): Alertas de trámites visados por el Comando Departamental.
- [Perfil.jsx](file:///c:/laragon/www/ofbol/resources/views/comando_general/Perfil.jsx): Ficha institucional del Comando General.

### 5. Infraestructura y UI (`resources/js/`)
- [api.js](file:///c:/laragon/www/ofbol/resources/js/lib/api.js): Cliente HTTP centralizado para consumir los 25 controladores REST.
- [AuthContext.jsx](file:///c:/laragon/www/ofbol/resources/js/context/AuthContext.jsx): Manejador de estado de sesión institucional.
- [LayoutSecretario.jsx](file:///c:/laragon/www/ofbol/resources/js/components/LayoutSecretario.jsx): Sidebar y Topbar con diseño institucional (Verde policial / tonos Slate modernos).
- [EstadoBadge.jsx](file:///c:/laragon/www/ofbol/resources/js/components/ui/EstadoBadge.jsx), [Spinner.jsx](file:///c:/laragon/www/ofbol/resources/js/components/ui/Spinner.jsx), [Modal.jsx](file:///c:/laragon/www/ofbol/resources/js/components/ui/Modal.jsx), [Alert.jsx](file:///c:/laragon/www/ofbol/resources/js/components/ui/Alert.jsx): Componentes UI reutilizables.
- [app.jsx](file:///c:/laragon/www/ofbol/resources/js/app.jsx): Configuración de rutas y navegación React.

## Validación
- Compilación de bundle de Vite ejecutada con éxito (`npm run build` con código de salida 0).
