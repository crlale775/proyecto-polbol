import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider, SyncProvider } from './components/ui/ToastEnVivo';
import ErrorBoundary from './components/ui/ErrorBoundary';
import Spinner from './components/ui/Spinner';
import SoundManager from './lib/sounds';

// 1. Vista Auth / Login (Carpeta independiente de los 3 roles) — carga inmediata
import Login from '../views/login/Login';

// 2. Vistas Secretario Unidad (EPI) — carga diferida (más rápido al entrar)
const SecretarioUnidadDashboard = lazy(() => import('../views/secretario_unidad/Dashboard'));
const SecretarioUnidadSubirDocumento = lazy(() => import('../views/secretario_unidad/SubirDocumento'));
const SecretarioUnidadMisDocumentos = lazy(() => import('../views/secretario_unidad/MisDocumentos'));
const SecretarioUnidadCorrecciones = lazy(() => import('../views/secretario_unidad/Correcciones'));
const SecretarioUnidadOficiales = lazy(() => import('../views/secretario_unidad/OficialesEpi'));
const SecretarioUnidadHistorial = lazy(() => import('../views/secretario_unidad/Historial'));
const SecretarioUnidadPlantillas = lazy(() => import('../views/secretario_unidad/Plantillas'));
const SecretarioUnidadReportes = lazy(() => import('../views/secretario_unidad/Reportes'));
const SecretarioUnidadNotificaciones = lazy(() => import('../views/secretario_unidad/Notificaciones'));
const SecretarioUnidadPerfil = lazy(() => import('../views/secretario_unidad/Perfil'));

// 3. Vistas Comando Departamental de La Paz — carga diferida
const ComandoDepartamentalDashboard = lazy(() => import('../views/secretario_comando_departamental/Dashboard'));
const ComandoDepartamentalRevision = lazy(() => import('../views/secretario_comando_departamental/RevisarDocumentos'));
const ComandoDepartamentalObservaciones = lazy(() => import('../views/secretario_comando_departamental/Observaciones'));
const ComandoDepartamentalHistorial = lazy(() => import('../views/secretario_comando_departamental/Historial'));
const ComandoDepartamentalTrazabilidad = lazy(() => import('../views/secretario_comando_departamental/Trazabilidad'));
const ComandoDepartamentalDocumentosEpi = lazy(() => import('../views/secretario_comando_departamental/DocumentosPorEpi'));
const ComandoDepartamentalDesempenio = lazy(() => import('../views/secretario_comando_departamental/DesempenioEpis'));
const ComandoDepartamentalGestionSecretarios = lazy(() => import('../views/secretario_comando_departamental/GestionSecretarios'));
const ComandoDepartamentalReportes = lazy(() => import('../views/secretario_comando_departamental/Reportes'));
const ComandoDepartamentalNotificaciones = lazy(() => import('../views/secretario_comando_departamental/Notificaciones'));
const ComandoDepartamentalPerfil = lazy(() => import('../views/secretario_comando_departamental/Perfil'));

// 4. Vistas Comando General de la Policía Boliviana — carga diferida
const ComandoGeneralDashboard = lazy(() => import('../views/comando_general/Dashboard'));
const ComandoGeneralDocumentos = lazy(() => import('../views/comando_general/DocumentosAprobados'));
const ComandoGeneralRegistro = lazy(() => import('../views/comando_general/RegistroDocumental'));
const ComandoGeneralTiposMemo = lazy(() => import('../views/comando_general/GestionTiposMemo'));
const ComandoGeneralHistorial = lazy(() => import('../views/comando_general/Historial'));
const ComandoGeneralTrazabilidad = lazy(() => import('../views/comando_general/Trazabilidad'));
const ComandoGeneralComparativo = lazy(() => import('../views/comando_general/ComparativoGeneral'));
const ComandoGeneralDirectorio = lazy(() => import('../views/comando_general/DirectorioInstitucional'));
const ComandoGeneralUsuarios = lazy(() => import('../views/comando_general/GestionUsuarios'));
const ComandoGeneralRegistroOficiales = lazy(() => import('../views/comando_general/RegistroOficialesIA'));
const ComandoGeneralAuditoria = lazy(() => import('../views/comando_general/Auditoria'));
const ComandoGeneralReportes = lazy(() => import('../views/comando_general/Reportes'));
const ComandoGeneralNotificaciones = lazy(() => import('../views/comando_general/Notificaciones'));
const ComandoGeneralPerfil = lazy(() => import('../views/comando_general/Perfil'));

// 5. Vista pública: registro del oficial por link
const RegistroOficial = lazy(() => import('../views/login/RegistroOficial'));

// Cargando elegante mientras entra cada módulo
function PageLoader() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 ofbol-animate-fade-in" style={{ background: 'radial-gradient(ellipse at top, #fbfaf7 0%, #f8f7f4 40%, #f6f4ef 100%)' }}>
            <div
                className="flex items-center justify-center rounded-xl ofbol-animate-scale-in"
                style={{
                    width: '44px',
                    height: '44px',
                    background: '#3d4a2c',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
                }}
            >
                <Spinner size="sm" />
            </div>
            <p className="text-xs font-bold text-slate-500 tracking-wide">Cargando módulo...</p>
        </div>
    );
}

function AppRoutes() {
    return (
        <Suspense fallback={<PageLoader />}>
            <Routes>
                {/* Login */}
                <Route path="/login" element={<Login />} />

                {/* Público: form de registro del oficial (llega por link de WhatsApp) */}
                <Route path="/registro-oficial/:token" element={<RegistroOficial />} />

                {/* Redirección raíz por defecto */}
                <Route path="/" element={<Navigate to="/login" replace />} />

                {/* ========================================================
                    RUTAS ROL 1: SECRETARIO EPI (SECRETARIO DE UNIDAD)
                ======================================================== */}
                <Route path="/secretario/dashboard" element={<SecretarioUnidadDashboard />} />
                <Route path="/secretario/subir-documento" element={<SecretarioUnidadSubirDocumento />} />
                <Route path="/secretario/mis-documentos" element={<SecretarioUnidadMisDocumentos />} />
                <Route path="/secretario/correcciones" element={<SecretarioUnidadCorrecciones />} />
                <Route path="/secretario/oficiales" element={<SecretarioUnidadOficiales />} />
                <Route path="/secretario/historial" element={<SecretarioUnidadHistorial />} />
                <Route path="/secretario/plantillas" element={<SecretarioUnidadPlantillas />} />
                <Route path="/secretario/reportes" element={<SecretarioUnidadReportes />} />
                <Route path="/secretario/notificaciones" element={<SecretarioUnidadNotificaciones />} />
                <Route path="/secretario/perfil" element={<SecretarioUnidadPerfil />} />

                {/* Alias de compatibilidad */}
                <Route path="/secretario-unidad/dashboard" element={<Navigate to="/secretario/dashboard" replace />} />
                <Route path="/secretario-unidad/subir-documento" element={<Navigate to="/secretario/subir-documento" replace />} />
                <Route path="/secretario-unidad/mis-documentos" element={<Navigate to="/secretario/mis-documentos" replace />} />
                <Route path="/secretario-unidad/correcciones" element={<Navigate to="/secretario/correcciones" replace />} />
                <Route path="/secretario-unidad/oficiales" element={<Navigate to="/secretario/oficiales" replace />} />
                <Route path="/secretario-unidad/historial" element={<Navigate to="/secretario/historial" replace />} />
                <Route path="/secretario-unidad/plantillas" element={<Navigate to="/secretario/plantillas" replace />} />
                <Route path="/secretario-unidad/reportes" element={<Navigate to="/secretario/reportes" replace />} />
                <Route path="/secretario-unidad/notificaciones" element={<Navigate to="/secretario/notificaciones" replace />} />
                <Route path="/secretario-unidad/perfil" element={<Navigate to="/secretario/perfil" replace />} />

                {/* ========================================================
                    RUTAS ROL 2: COMANDO DEPARTAMENTAL DE LA PAZ
                ======================================================== */}
                <Route path="/comando-departamental/dashboard" element={<ComandoDepartamentalDashboard />} />
                <Route path="/comando-departamental/revision" element={<ComandoDepartamentalRevision />} />
                <Route path="/comando-departamental/observaciones" element={<ComandoDepartamentalObservaciones />} />
                <Route path="/comando-departamental/historial" element={<ComandoDepartamentalHistorial />} />
                <Route path="/comando-departamental/trazabilidad" element={<ComandoDepartamentalTrazabilidad />} />
                <Route path="/comando-departamental/documentos-epi" element={<ComandoDepartamentalDocumentosEpi />} />
                {/* Desempeño y Estadísticas viven en una sola vista (módulo fusionado) */}
                <Route path="/comando-departamental/desempenio" element={<ComandoDepartamentalDesempenio />} />
                <Route path="/comando-departamental/estadisticas" element={<Navigate to="/comando-departamental/desempenio" replace />} />
                <Route path="/comando-departamental/secretarios" element={<ComandoDepartamentalGestionSecretarios />} />
                <Route path="/comando-departamental/reportes" element={<ComandoDepartamentalReportes />} />
                <Route path="/comando-departamental/notificaciones" element={<ComandoDepartamentalNotificaciones />} />
                <Route path="/comando-departamental/perfil" element={<ComandoDepartamentalPerfil />} />

                {/* ========================================================
                    RUTAS ROL 3: COMANDO GENERAL DE LA POLICÍA BOLIVIANA
                ======================================================== */}
                <Route path="/comando-general/dashboard" element={<ComandoGeneralDashboard />} />
                <Route path="/comando-general/documentos" element={<ComandoGeneralDocumentos />} />
                <Route path="/comando-general/registro" element={<ComandoGeneralRegistro />} />
                <Route path="/comando-general/tipos-memo" element={<ComandoGeneralTiposMemo />} />
                <Route path="/comando-general/historial" element={<ComandoGeneralHistorial />} />
                <Route path="/comando-general/trazabilidad" element={<ComandoGeneralTrazabilidad />} />
                <Route path="/comando-general/comparativo" element={<ComandoGeneralComparativo />} />
                <Route path="/comando-general/directorio" element={<ComandoGeneralDirectorio />} />
                <Route path="/comando-general/usuarios" element={<ComandoGeneralUsuarios />} />
                <Route path="/comando-general/registro-oficiales" element={<ComandoGeneralRegistroOficiales />} />
                <Route path="/comando-general/auditoria" element={<ComandoGeneralAuditoria />} />
                <Route path="/comando-general/reportes" element={<ComandoGeneralReportes />} />
                <Route path="/comando-general/notificaciones" element={<ComandoGeneralNotificaciones />} />
                <Route path="/comando-general/perfil" element={<ComandoGeneralPerfil />} />

                {/* Ruta por defecto */}
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </Suspense>
    );
}

function App() {
    React.useEffect(() => {
        // Política de autoplay: el AudioContext solo se autoriza tras un gesto
        // real del usuario. Se desbloquea una vez, en el primer contacto, y no
        // vuelve a tocar el DOM.
        const desbloquear = () => SoundManager.desbloquear();
        document.addEventListener('pointerdown', desbloquear, { capture: true });
        document.addEventListener('keydown', desbloquear, { capture: true });

        // Enviar es un evento importante del sistema, no un botón: el sonido
        // se dispara cuando un formulario se remite de verdad, no en cada click.
        const alEnviar = (e) => {
            if (e.target instanceof HTMLFormElement) SoundManager.enviar();
        };
        document.addEventListener('submit', alEnviar, { capture: true });

        return () => {
            document.removeEventListener('pointerdown', desbloquear, { capture: true });
            document.removeEventListener('keydown', desbloquear, { capture: true });
            document.removeEventListener('submit', alEnviar, { capture: true });
        };
    }, []);

    return (
        <ErrorBoundary>
            <AuthProvider>
                <ToastProvider>
                    <SyncProvider>
                        <BrowserRouter>
                            <AppRoutes />
                        </BrowserRouter>
                    </SyncProvider>
                </ToastProvider>
            </AuthProvider>
        </ErrorBoundary>
    );
}

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}