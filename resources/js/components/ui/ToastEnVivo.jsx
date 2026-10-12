/**
 * Sistema de toasts EN VIVO + contexto global de sincronización.
 *
 * - ToastProvider: pila de notificaciones flotantes (esquina inferior derecha)
 *   con animación de entrada/salida.
 * - useToast(): mostrar un toast desde cualquier componente.
 * - useSyncGlobal(): estado de conexión compartido por todos los layouts
 *   (un solo sondeo para toda la app, los eventos llegan vía window).
 */
import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    useCallback,
} from 'react';
import { Check, Info, AlertTriangle, Bell } from 'lucide-react';
import useSincronizacion from '../../lib/useSincronizacion';
import { useAuth } from '../../context/AuthContext';
import SoundManager from '../../lib/sounds';

const ToastContext = createContext(null);

/**
 * Cada aviso suena distinto: una confirmación no se oye como una advertencia
 * ni como una llegada. Es la identidad sonora del sistema, no un pitido único.
 */
const SONIDO_POR_TIPO = {
    success: 'exito',
    error: 'error',
    warning: 'advertencia',
    alerta: 'advertencia',
    info: 'notificacion',
};

const ETIQUETAS_ESTADO = {
    1: 'Borrador',
    2: 'Enviado por EPI',
    3: 'En Revisión',
    4: 'Observado',
    5: 'Reenviado',
    6: 'Aprobado',
    7: 'Remitido',
    8: 'Registrado',
};

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const idRef = useRef(0);

    const mostrar = useCallback((toast) => {
        const id = ++idRef.current;
        SoundManager[SONIDO_POR_TIPO[toast.tipo] ?? 'notificacion']();
        setToasts((pila) => [...pila.slice(-4), { id, ...toast }]);
        setTimeout(() => {
            setToasts((pila) => pila.filter((t) => t.id !== id));
        }, toast.duracion ?? 6000);
    }, []);

    const cerrar = useCallback((id) => {
        setToasts((pila) => pila.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={mostrar}>
            {children}
            <div
                className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 pointer-events-none"
                aria-live="polite"
            >
                {toasts.map((t) => (
                    <Toast key={t.id} toast={t} onCerrar={() => cerrar(t.id)} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

function Toast({ toast, onCerrar }) {
    const [saliendo, setSaliendo] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setSaliendo(true), (toast.duracion ?? 6000) - 400);
        return () => clearTimeout(t);
    }, [toast.duracion]);

    // R1 · superficies planas: el lavado es un color institucional, no un gradiente.
    const colores = {
        success: { borde: '#1a5c52', fondo: '#e6efec', Icono: Check },
        info: { borde: '#9a6f0a', fondo: '#f7f0dd', Icono: Info },
        warning: { borde: '#9a6f0a', fondo: '#f7f0dd', Icono: AlertTriangle },
        alerta: { borde: '#8f2020', fondo: '#f6e9e7', Icono: AlertTriangle },
        error: { borde: '#8f2020', fondo: '#f6e9e7', Icono: AlertTriangle },
    }[toast.tipo] || { borde: '#3d4a2c', fondo: '#eef0e8', Icono: Bell };

    return (
        <div
            className={`pointer-events-auto w-[340px] rounded-xl border overflow-hidden ${saliendo ? 'ofbol-toast-out' : 'ofbol-toast-in'}`}
            style={{
                background: colores.fondo,
                borderColor: colores.borde,
                boxShadow: '0 12px 32px rgba(10, 15, 13, 0.18), 0 2px 8px rgba(10, 15, 13, 0.08)',
            }}
            role="status"
        >
            <div className="flex items-start gap-3 p-3.5">
                <span
                    className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg text-white"
                    style={{ background: colores.borde }}
                    aria-hidden="true"
                >
                    <colores.Icono size={14} strokeWidth={2.5} />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-black text-[#0a0f0d] uppercase tracking-wide leading-tight">
                        {toast.titulo}
                    </p>
                    {toast.detalle && (
                        <p className="text-[11px] text-[#3f4849] mt-0.5 leading-snug">{toast.detalle}</p>
                    )}
                </div>
                <button
                    onClick={onCerrar}
                    className="shrink-0 text-[#5a615f] hover:text-[#0a0f0d] transition-colors"
                    aria-label="Cerrar notificación"
                >
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
                        <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            {/* Barra de vida del toast */}
            <div className="h-[3px]" style={{ background: 'rgba(0,0,0,0.06)' }}>
                <div className="h-full ofbol-toast-vida" style={{ background: colores.borde }} />
            </div>
        </div>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) return () => {};
    return ctx;
}

/**
 * Indicador EN VIVO (chip pulsante para headers).
 * verde = conectado · rojo = sin conexión · gris = conectando
 */
export function ChipEnVivo({ conectado }) {
    const color = conectado === null ? '#a8a5a0' : conectado ? '#1a5c52' : '#8f2020';
    return (
        <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-[0.14em]"
            style={{
                background: conectado === false ? 'rgba(143,32,32,0.08)' : 'rgba(26,92,82,0.08)',
                borderColor: `${color}55`,
                color,
            }}
            title={conectado === false ? 'Sin conexión con el servidor' : 'Sincronización en vivo activa'}
        >
            <span className="relative flex h-1.5 w-1.5">
                {conectado !== false && (
                    <span
                        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                        style={{ background: color }}
                    />
                )}
                <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: color }} />
            </span>
            {conectado === null ? 'Conectando…' : conectado ? 'En vivo' : 'Sin conexión'}
        </span>
    );
}

/**
 * SyncProvider — UN solo sondeo para toda la app. Detecta eventos de
 * documentos/solicitudes y dispara toasts + evento window 'ofbol:sync'
 * para que las páginas activas refresquen sus datos.
 */
export function SyncProvider({ children }) {
    const mostrar = useToast();
    const { user } = useAuth();

    const onDocumento = useCallback(
        (eventos) => {
            eventos.forEach((ev) => {
                if (ev.tipo === 'creado') {
                    mostrar({
                        tipo: 'info',
                        titulo: 'Nuevo documento en el sistema',
                        detalle: `Un memorándum fue ingresado desde una EPI (doc #${ev.id_documento}).`,
                    });
                } else {
                    mostrar({
                        tipo: ev.estado_actual >= 6 ? 'success' : 'info',
                        titulo: 'Movimiento de documento',
                        detalle: `Doc #${ev.id_documento}: ${ETIQUETAS_ESTADO[ev.antes] || 'estado previo'} → ${
                            ETIQUETAS_ESTADO[ev.estado_actual] || 'nuevo estado'
                        }.`,
                    });
                }
            });
            window.dispatchEvent(new CustomEvent('ofbol:sync', { detail: { documentos: eventos } }));
        },
        [mostrar]
    );

    const onSolicitud = useCallback(
        (eventos) => {
            eventos.forEach((ev) => {
                if (ev.tipo === 'nueva') {
                    mostrar({
                        tipo: 'info',
                        titulo: '🆕 Solicitud de registro recibida',
                        detalle: `Solicitud #${ev.id_solicitud} en espera de revisión.`,
                    });
                } else {
                    mostrar({
                        tipo: 'success',
                        titulo: 'Solicitud actualizada',
                        detalle: `Solicitud #${ev.id_solicitud} cambió de estado.`,
                    });
                }
            });
            window.dispatchEvent(new CustomEvent('ofbol:sync', { detail: { solicitudes: eventos } }));
        },
        [mostrar]
    );

    // Las unidades (Secretarías EPI) solo escuchan los movimientos de SU estación;
    // Comando Dptal. y General ven el panorama completo.
    const esUnidad = String(user?.rol ?? '').toLowerCase().includes('secretario');
    const idEpiFiltro = esUnidad ? (user?.id_epi ?? null) : null;

    const { conectado, ultimoChequeo, resumenEpi } = useSincronizacion({
        onDocumento,
        onSolicitud,
        idEpi: idEpiFiltro,
    });

    const valor = useMemo(
        () => ({ conectado, ultimoChequeo, resumenEpi }),
        [conectado, ultimoChequeo, resumenEpi]
    );

    return <SyncContext.Provider value={valor}>{children}</SyncContext.Provider>;
}

const SyncContext = createContext({ conectado: null, ultimoChequeo: null, resumenEpi: [] });

export function useSyncGlobal() {
    return useContext(SyncContext);
}
