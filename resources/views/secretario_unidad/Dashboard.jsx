/**
 * Dashboard — Inicio del Secretario EPI (rol 1) · enfoque OPERATIVO
 *
 * Datos: UNA petición ligera a /api/panel/unidad (conteos agregados y listas
 * cortas) + las notificaciones del usuario. Antes se descargaba /documentos
 * completo con todas sus relaciones anidadas.
 *
 * La situación del flujo se lee como gráfico (banda de composición, tendencia
 * mensual, comparativa por tipo, línea de actividad) y no como listas de
 * frases: el texto queda para lo que hay que decidir.
 *
 * Identidad: oliva institucional (la EPI es el nivel operativo).
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    FileText, Send, AlertTriangle, CheckCircle2, FolderOpen, History,
    Users, UploadCloud, Bell, Clock3, PencilLine, Plus, ArrowRight, Zap, ArrowUpRight,
} from 'lucide-react';
import LayoutSecretario from '../../js/components/LayoutSecretario';
import Alert from '../../js/components/ui/Alert';
import {
    BandaEstados, GraficoLineas, ComparativaEntidades, LineaTiempo, EstadoVacio,
} from '../../js/components/ui/Graficos';
import { KpiPanel, SeccionPanel, SkeletonPanel, AccionRapida, ACENTOS } from '../../js/components/ui/Panel';
import { COLOR_ESTADO, ORDEN_ESTADOS } from '../../js/constants/ofbol';
import { useAuth } from '../../js/context/AuthContext';
import api from '../../js/lib/api';

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function tiempoRelativo(fecha) {
    if (!fecha) return 'Recientemente';
    const min = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
    if (min < 1) return 'Hace un momento';
    if (min < 60) return `Hace ${min} min`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `Hace ${hrs} h`;
    const dias = Math.floor(hrs / 24);
    if (dias < 30) return `Hace ${dias} d`;
    return new Date(fecha).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' });
}

const fechaHora = (f) =>
    f ? new Date(f).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export default function Dashboard() {
    const { user } = useAuth();
    const [panel, setPanel] = useState(null);
    const [notificaciones, setNotificaciones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const cargar = useCallback(async (silencioso = false) => {
        if (!user?.id_epi) return;
        try {
            if (!silencioso) setLoading(true);
            const [p, notifs] = await Promise.all([
                api.get(`/panel/unidad?id_epi=${user.id_epi}`),
                user?.id_usuario ? api.get(`/notificaciones?id_usuario=${user.id_usuario}`) : Promise.resolve([]),
            ]);
            if (p) setPanel(p);
            setNotificaciones(Array.isArray(notifs) ? notifs : []);
        } catch {
            setError('No se pudieron cargar los datos. Verificá la conexión con el servidor.');
        } finally {
            if (!silencioso) setLoading(false);
        }
    }, [user?.id_epi, user?.id_usuario]);

    useEffect(() => { void cargar(); }, [cargar]);

    // Refresco en vivo cuando el Comando mueve un documento de esta EPI
    useEffect(() => {
        const onSync = () => { void cargar(true); };
        window.addEventListener('ofbol:sync', onSync);
        return () => window.removeEventListener('ofbol:sync', onSync);
    }, [cargar]);

    const resumen = panel?.resumen ?? {};

    /* Composición por estado, siempre en el orden del ciclo de vida. */
    const porEstado = useMemo(() => {
        const brutos = panel?.por_estado ?? [];
        return brutos
            .map((e) => ({ label: e.estado, estado: e.estado, total: e.total, color: COLOR_ESTADO[e.estado] ?? ACENTOS.steel }))
            .toSorted((a, b) => {
                const ia = ORDEN_ESTADOS.indexOf(a.estado);
                const ib = ORDEN_ESTADOS.indexOf(b.estado);
                return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
            });
    }, [panel]);

    const porTipo = useMemo(
        () => (panel?.por_tipo ?? []).map((t) => ({
            label: t.tipo,
            nombre: t.tipo,
            total: t.total,
            segmentos: [{ label: t.tipo, total: t.total, color: ACENTOS.oliva }],
        })),
        [panel]
    );

    /* La tendencia mensual exige leer las claves del backend, no inventarlas. */
    const serieMes = useMemo(() => {
        const meses = panel?.por_mes ?? [];
        return {
            categorias: meses.map((m) => {
                const [, mes] = String(m.mes).split('-');
                return MES_CORTO[Number(mes) - 1] ?? mes;
            }),
            series: [
                {
                    label: 'Emitidos',
                    color: ACENTOS.oliva,
                    tipo: 'area',
                    valores: meses.map((m) => m.total ?? 0),
                },
                {
                    label: 'Aprobados',
                    color: ACENTOS.teal,
                    tipo: 'linea',
                    valores: meses.map((m) => m.aprobados ?? 0),
                },
                {
                    label: 'Observados',
                    color: ACENTOS.ambar,
                    tipo: 'linea',
                    valores: meses.map((m) => m.observados ?? 0),
                },
            ],
        };
    }, [panel]);

    const actividad = panel?.actividad ?? [];
    const noLeidas = notificaciones.filter((n) => !n.leido).length;
    const notifsRecientes = notificaciones.slice(0, 3);
    const observados = resumen.observados ?? 0;

    const hora = new Date().getHours();
    const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';

    /* La actividad reciente como línea de tiempo, no como lista de texto. */
    const eventosActividad = useMemo(
        () => actividad.map((doc) => ({
            id: doc.id_documento,
            titulo: doc.codigo_documento,
            fecha: tiempoRelativo(doc.fecha_subida),
            detalle: `${doc.tipo_documento?.nombre ?? 'Documento'} · ${doc.oficial?.nombres ?? ''} ${doc.oficial?.apellidos ?? ''}`.trim(),
            tonoEstado: doc.estado?.nombre,
            meta: doc.estado?.nombre ? [{ texto: doc.estado.nombre, tono: 'olive' }] : [],
        })),
        [actividad]
    );

    return (
        <LayoutSecretario notifCount={noLeidas}>
            <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 ofbol-page-enter">
                {/* ── Encabezado ── */}
                <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="ofbol-display">
                            {saludo}, {user?.usuario ?? 'Secretario'}
                        </h1>
                        <p className="ofbol-nota mt-2">
                            {user?.epi || 'EPI asignada'}
                            <span className="text-[#cfc9bc]"> · </span>
                            {new Date().toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                    <Link to="/secretario/subir-documento" className="ofbol-btn-primary self-start sm:self-auto">
                        <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
                        Subir documento
                    </Link>
                </header>

                {error && <Alert type="warning" onClose={() => setError(null)}>{error}</Alert>}

                {loading ? <SkeletonPanel /> : (
                    <>
                        {/* ── Aviso de subsanación pendiente ── */}
                        {observados > 0 && (
                            <Link
                                to="/secretario/correcciones"
                                className="ofbol-lift flex items-center gap-3 p-4 rounded-[14px]"
                                style={{ background: '#f6e9e7', border: '1px solid rgba(143,32,32,0.22)' }}
                            >
                                <span
                                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ background: 'rgba(143,32,32,0.1)', color: ACENTOS.crimson }}
                                    aria-hidden="true"
                                >
                                    <AlertTriangle size={17} strokeWidth={2} />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[13px] font-black text-[#14181a]">
                                        {observados} trámite{observados === 1 ? '' : 's'} requieren corrección
                                    </span>
                                    <span className="block text-[11.5px] text-[#3f4849] mt-0.5">
                                        Corregí, verificá el PDF con la IA y re-enviá.
                                    </span>
                                </span>
                                <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wide shrink-0" style={{ color: ACENTOS.crimson }}>
                                    Subsanar <ArrowRight size={13} strokeWidth={2.4} aria-hidden="true" />
                                </span>
                            </Link>
                        )}

                        {/* ── Indicadores: una cifra líder, el resto secundarias ── */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 ofbol-stagger">
                            <KpiPanel grande etiqueta="Documentos" valor={resumen.total ?? 0} icono={<FileText size={15} strokeWidth={1.9} />} acento={ACENTOS.steel} sub={`${resumen.hoy ?? 0} hoy`} />
                            <KpiPanel etiqueta="En trámite" valor={resumen.en_proceso ?? 0} icono={<Send size={15} strokeWidth={1.9} />} acento={ACENTOS.ambar} sub="enviados / en revisión" />
                            <KpiPanel etiqueta="Observados" valor={observados} icono={<AlertTriangle size={15} strokeWidth={1.9} />} acento={ACENTOS.crimson} sub="para subsanar" />
                            <KpiPanel etiqueta="Aprobados" valor={resumen.aprobados ?? 0} icono={<CheckCircle2 size={15} strokeWidth={1.9} />} acento={ACENTOS.teal} sub="remitidos al C.G." />
                            <KpiPanel etiqueta="Registrados" valor={resumen.registrados ?? 0} icono={<CheckCircle2 size={15} strokeWidth={1.9} />} acento={ACENTOS.oliva} sub="flujo cerrado" />
                        </div>

                        {/* ── Situación del flujo + acciones ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                            <SeccionPanel
                                titulo="Situación del flujo"
                                detalle="Composición actual de mis trámites"
                                className="lg:col-span-2"
                            >
                                <BandaEstados datos={porEstado} grande />
                            </SeccionPanel>

                            <SeccionPanel titulo="Acciones rápidas" accion={<Zap size={15} className="shrink-0" style={{ color: ACENTOS.ambar }} aria-hidden="true" />}>
                                <div className="space-y-2">
                                    <AccionRapida LinkComponent={Link} to="/secretario/subir-documento" destacada label="Subir documento" detalle="Registrar un nuevo trámite" icono={<UploadCloud size={15} />} />
                                    {observados > 0 && (
                                        <AccionRapida LinkComponent={Link} to="/secretario/correcciones" label="Correcciones" detalle={`${observados} pendientes de subsanar`} icono={<PencilLine size={15} />} />
                                    )}
                                    <AccionRapida LinkComponent={Link} to="/secretario/mis-documentos" label="Mis documentos" detalle="Gestionar mis trámites" icono={<FolderOpen size={15} />} />
                                    <AccionRapida LinkComponent={Link} to="/secretario/oficiales" label="Personal de la EPI" detalle="Efectivos de la unidad" icono={<Users size={15} />} />
                                    <AccionRapida LinkComponent={Link} to="/secretario/historial" label="Historial" detalle="Cambios de estado" icono={<History size={15} />} />
                                </div>
                            </SeccionPanel>
                        </div>

                        {/* ── Tendencia y tipos ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                            <SeccionPanel titulo="Evolución mensual" detalle="Emitidos, aprobados y observados" className="lg:col-span-2">
                                {serieMes.categorias.length > 0 ? (
                                    <GraficoLineas altura={210} categorias={serieMes.categorias} series={serieMes.series} />
                                ) : (
                                    <EstadoVacio compacto icono={FileText} titulo="Todavía no hay meses con actividad" />
                                )}
                            </SeccionPanel>

                            <SeccionPanel titulo="Por tipo de trámite" detalle="Volumen de mis trámites">
                                {porTipo.length > 0 ? (
                                    <ComparativaEntidades filas={porTipo.slice(0, 6)} />
                                ) : (
                                    <EstadoVacio compacto icono={FileText} titulo="Sin trámites por tipo" />
                                )}
                            </SeccionPanel>
                        </div>

                        {/* ── Actividad + notificaciones ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                            <SeccionPanel
                                titulo="Actividad reciente"
                                detalle="Últimos movimientos de mi unidad"
                                className="lg:col-span-2"
                                accion={
                                    <Link
                                        to="/secretario/mis-documentos"
                                        className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wide shrink-0"
                                        style={{ color: ACENTOS.oliva }}
                                    >
                                        Ver todos <ArrowUpRight size={13} strokeWidth={2.4} aria-hidden="true" />
                                    </Link>
                                }
                            >
                                {eventosActividad.length === 0 ? (
                                    <EstadoVacio
                                        icono={FileText}
                                        titulo="Sin actividad todavía"
                                        nota="Cuando registres tu primer memorándum vas a ver acá su recorrido."
                                        accion={
                                            <Link to="/secretario/subir-documento" className="ofbol-btn-ghost mt-1">
                                                Subir el primero
                                            </Link>
                                        }
                                    />
                                ) : (
                                    <LineaTiempo eventos={eventosActividad} ariaLabel="Actividad reciente de mi EPI" />
                                )}
                            </SeccionPanel>

                            <SeccionPanel
                                titulo="Notificaciones"
                                detalle={noLeidas > 0 ? `${noLeidas} sin leer` : 'Al día'}
                                accion={<Bell size={15} className="shrink-0" style={{ color: ACENTOS.oliva }} aria-hidden="true" />}
                            >
                                {notifsRecientes.length === 0 ? (
                                    <EstadoVacio compacto icono={Bell} titulo="Sin notificaciones nuevas" />
                                ) : (
                                    <ul className="space-y-2.5">
                                        {notifsRecientes.map((n) => (
                                            <li
                                                key={n.id_notificacion}
                                                className="rounded-xl p-3"
                                                style={{ border: '1px solid #e3dfd6', opacity: n.leido ? 0.6 : 1 }}
                                            >
                                                <div className="flex items-start gap-2">
                                                    <span
                                                        className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                                                        style={{ background: '#eef0e8', color: ACENTOS.oliva }}
                                                        aria-hidden="true"
                                                    >
                                                        <Bell size={12} strokeWidth={2} />
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[11.5px] font-bold text-[#14181a] line-clamp-2">{n.titulo}</p>
                                                        {n.mensaje && <p className="text-[10.5px] text-[#5a615f] mt-0.5 line-clamp-2">{n.mensaje}</p>}
                                                        <p className="text-[10px] text-[#969b98] mt-1 flex items-center gap-1 tabular-nums">
                                                            <Clock3 size={9} aria-hidden="true" /> {fechaHora(n.fecha)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                        <li>
                                            <Link
                                                to="/secretario/notificaciones"
                                                className="block text-center text-[11px] font-black uppercase tracking-wide pt-1"
                                                style={{ color: ACENTOS.oliva }}
                                            >
                                                Ver todas
                                            </Link>
                                        </li>
                                    </ul>
                                )}
                            </SeccionPanel>
                        </div>
                    </>
                )}
            </div>
        </LayoutSecretario>
    );
}
