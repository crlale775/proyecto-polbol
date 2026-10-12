# Plan de Implementación — Módulo Secretario EPI (OFBOL)

Implementación integral y exclusiva del módulo **Secretario EPI (Secretario de Unidad)** para el sistema **OFBOL (Policía Boliviana)**.

## Arquitectura y Restricciones
- **Framework backend**: Laravel 12 (PHP) con PostgreSQL.
- **Frontend**: React 19 SPA administrado por Vite y TailwindCSS.
- **Modelos y Controladores**: Uso estricto de los 25 modelos y 25 controladores REST correspondientes a las tablas existentes.
- **Sin capas adicionales**: Sin repositories, sin services, sin livewire, sin inertia, sin alteraciones al esquema de base de datos.
- **Ubicación de vistas**: `resources/views/secretario_unidad/`.

## Pantallas Desarrolladas
1. **Login (`Login.jsx`)**: Pantalla institucional con autenticación conectada a `UsuarioController` y `EpiController`.
2. **Dashboard (`Dashboard.jsx`)**: Resumen de métricas de la EPI, últimos documentos, accesos rápidos y panel de notificaciones.
3. **Subir Documento (`SubirDocumento.jsx`)**:
   - Registro de documentos físicos.
   - Buscador de oficiales (`OficialController`).
   - Selector de tipos de documento (`TipoDocumentoController`).
   - Carga de PDF y cálculo automático de hash SHA-256.
   - Motor de validaciones preventivas del Sistema Experto.
   - Creación en `DocumentoController` y `VersionDocumentoController`.
4. **Mis Documentos (`MisDocumentos.jsx`)**: Tabla de documentos con búsqueda, filtros por tipo y estado, ordenamiento, paginación y modal de detalle con revisiones.
5. **Historial (`Historial.jsx`)**: Timeline interactivo de trazabilidad de estados (`HistorialEstadoController`).
6. **Notificaciones (`Notificaciones.jsx`)**: Bandeja con lectura de avisos y observaciones (`NotificacionController`).
7. **Perfil (`Perfil.jsx`)**: Datos institucionales y detalles de la cuenta activa.

## Verificación
- Compilación de bundle de producción con Vite (`npm run build`).
