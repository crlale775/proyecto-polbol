/**
 * Dashboard — Inicio del Comando Departamental de La Paz (rol 2) · COMPARATIVO
 *
 * Datos: UNA petición ligera a /api/panel/departamental (conteos, las 9 EPIs y
 * 6 documentos recientes con columnas mínimas). Antes se pedían /documentos,
 * /epis y /revisiones completos.
 *
 * Identidad: ámbar institucional (nivel de supervisión departamental).
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LayoutComandoDepartamental from '../../js/components/LayoutComandoDepartamental';
import EstadoBadge from '../../js/components/ui/EstadoBadge';
import EdificioEPI from '../../js/components/ui/EdificioEPI';
import Alert from '../../js/components/ui/Alert';
import {
    KpiPanel, SeccionPanel, AnilloPanel, SkeletonPanel,
    AccionRapida, ACENTOS,
} from '../../js/components/ui/Panel';
import { MapaCalor, alfa } from '../../js/components/ui/Graficos';
import { ChipEnVivo, useSyncGlobal } from '../../js/components/ui/ToastEnVivo';
import api from '../../js/lib/api';
import {
    ClipboardCheck, Inbox, AlertTriangle, CheckCircle2,
    FolderOpen, TrendingUp, BarChart3, History, Lock, ArrowRight,
} from 'lucide-react';

export default function Dashboard() {
    const navigate = useNavigate();
    const { conectado } = useSyncGlobal();
    const [panel, setPanel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const cargar = useCallback(async (silencioso = false) => {
        try {
            if (!silencioso) setLoading(true);
            const res = await api.get('/panel/departamental');
            if (res) setPanel(res);
        } catch {
            setError('Error al sincronizar con el servidor de la base de datos.');
        } finally {
            if (!silencioso) setLoading(false);
        }
    }, []);

    useEffect(() => { void cargar(); }, [cargar]);

    useEffect(() => {
        const onSync = () => { void cargar(true); };
        window.addEventListener('ofbol:sync', onSync);
        return () => window.removeEventListener('ofbol:sync', onSync);
    }, [cargar]);

    const resumen = panel?.resumen ?? {};
    const porEpi = panel?.por_epi ?? [];
    const recientes = panel?.recientes ?? [];

    /* Cruce EPI × estado: el mapa de calor reemplaza la lista de barras y
       muestra de un golpe dónde se acumula el trabajo y dónde la devolución. */
    const filasCruce = porEpi.map((e) => ({
        id: e.id_epi,
        nombre: e.nombre,
        valores: [e.pendientes ?? 0, e.observados ?? 0, e.registrados ?? 0, e.total ?? 0],
    }));
    const columnasCruce = [
        { label: 'Pendientes', color: ACENTOS.ambar },
        { label: 'Observados', color: ACENTOS.crimson },
        { label: 'Registrados', color: ACENTOS.teal },
        { label: 'Total', color: ACENTOS.oliva },
    ];

    return (
        <LayoutComandoDepartamental>
            <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 ofbol-page-enter">
                {/* ── Encabezado ── */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="ofbol-badge ofbol-badge--amber">Instancia Departamental</span>
                            <span className="text-xs text-slate-400">· Supervisión de las 9 EPIs de La Paz</span>
                            <ChipEnVivo conectado={conectado} />
                        </div>
                        <h1 className="ofbol-display heading-balance">Panel de control y revisión</h1>
                        <p className="ofbol-nota mt-2">
                            Estado del flujo documental de las Estaciones Policiales Integrales del departamento.
                        </p>
                    </div>
                    <Link to="/comando-departamental/revision" className="ofbol-btn-primary ofbol-sheen self-start sm:self-auto">
                        <ClipboardCheck size={15} /> Cola de revisión ({resumen.en_proceso ?? 0})
                    </Link>
                </div>

                {error && <Alert type="warning" onClose={() => setError(null)}>{error}</Alert>}

                {loading ? <SkeletonPanel /> : (
                    <>
                        {/* ── KPIs ── */}
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 ofbol-stagger">
                            <KpiPanel etiqueta="Pendientes" valor={resumen.en_proceso ?? 0} sub="requieren dictamen" icono={<ClipboardCheck size={15} strokeWidth={1.9} />} acento={ACENTOS.ambar} />
                            <KpiPanel etiqueta="Recibidos hoy" valor={resumen.hoy ?? 0} sub="entradas del día" icono={<Inbox size={15} strokeWidth={1.9} />} acento={ACENTOS.olivaClaro} />
                            <KpiPanel etiqueta="Observados" valor={resumen.observados ?? 0} sub="devueltos a EPIs" icono={<AlertTriangle size={15} strokeWidth={1.9} />} acento={ACENTOS.crimson} />
                            <KpiPanel etiqueta="Aprobados" valor={resumen.aprobados ?? 0} sub="remitidos al C. General" icono={<CheckCircle2 size={15} strokeWidth={1.9} />} acento={ACENTOS.teal} />
                            <div className="ofbol-card p-5 flex items-center gap-4">
                                <AnilloPanel porcentaje={resumen.tasa_cierre ?? 0} etiqueta="cierre" acento={ACENTOS.ambar} size={92} />
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Total</p>
                                    <p className="text-2xl font-black tabular-nums text-[#0a0f0d] leading-none mt-1">{resumen.total ?? 0}</p>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1">
                                        {resumen.registrados ?? 0} registrados
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* ── Campus de las 9 EPIs ── */}
                        {porEpi.length > 0 && (
                            <SeccionPanel
                                titulo="Campus operativo · las 9 EPIs"
                                detalle="Las luces reflejan la carga real. Hacé clic para abrir la jurisdicción."
                                accion={
                                    <Link to="/comando-departamental/documentos-epi" className="text-[11px] font-black uppercase tracking-wide shrink-0" style={{ color: ACENTOS.ambar }}>
                                        Abrir campus →
                                    </Link>
                                }
                            >
                                <div className="ofbol-campus">
                                    <div className="ofbol-campus-grid">
                                        {porEpi.map((epi, i) => (
                                            <EdificioEPI
                                                key={epi.id_epi}
                                                epi={epi}
                                                index={i}
                                                resumen={{
                                                    total: epi.total,
                                                    en_revision: epi.pendientes,
                                                    observados: epi.observados,
                                                    aprobados: epi.registrados,
                                                }}
                                                onClick={() => navigate('/comando-departamental/documentos-epi')}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </SeccionPanel>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* ── Últimos recibidos ── */}
                            <div className="lg:col-span-2 min-w-0">
                                <SeccionPanel
                                    titulo="Últimos documentos recibidos"
                                    detalle="Documentación remitida por los Secretarios de las 9 EPIs"
                                    accion={
                                        <Link to="/comando-departamental/revision" className="text-[11px] font-black uppercase tracking-wide shrink-0" style={{ color: ACENTOS.ambar }}>
                                            Ver cola →
                                        </Link>
                                    }
                                >
                                    {recientes.length === 0 ? (
                                        <p className="text-[11px] text-slate-400 text-center py-10">No hay documentos registrados.</p>
                                    ) : (
                                        <div className="overflow-x-auto -mx-2">
                                            <table className="ofbol-table w-full">
                                                <thead>
                                                    <tr>
                                                        <th className="text-left">Código</th>
                                                        <th className="text-left">EPI</th>
                                                        <th className="text-left">Oficial</th>
                                                        <th className="text-left">Estado</th>
                                                        <th className="text-right">Acción</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {recientes.map((doc) => (
                                                        <tr key={doc.id_documento}>
                                                            <td className="whitespace-nowrap">
                                                                <p className="font-mono font-black text-[#0a0f0d]">{doc.codigo_documento}</p>
                                                                <p className="text-[10px] text-slate-400">
                                                                    {doc.fecha_subida ? new Date(doc.fecha_subida).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' }) : '—'}
                                                                </p>
                                                            </td>
                                                            <td>
                                                                <span className="inline-flex px-2 py-0.5 rounded-lg bg-slate-100 font-bold text-slate-700 text-[10.5px]">
                                                                    {doc.epi?.nombre ?? 'EPI'}
                                                                </span>
                                                            </td>
                                                            <td className="min-w-0">
                                                                <p className="font-bold text-slate-800 truncate">
                                                                    {doc.oficial?.grado?.abreviatura ? `${doc.oficial.grado.abreviatura} ` : ''}
                                                                    {doc.oficial?.nombres} {doc.oficial?.apellidos}
                                                                </p>
                                                                <p className="text-[10px] text-slate-400">CI: {doc.oficial?.ci ?? '—'}</p>
                                                            </td>
                                                            <td><EstadoBadge nombre={doc.estado?.nombre ?? 'Borrador'} /></td>
                                                            <td className="text-right whitespace-nowrap">
                                                                <Link
                                                                    to="/comando-departamental/revision"
                                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-black"
                                                                    style={{ background: alfa(ACENTOS.ambar, 0.1), color: ACENTOS.ambar }}
                                                                >
                                                                    Revisar <ArrowRight size={12} strokeWidth={2.4} aria-hidden="true" />
                                                                </Link>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </SeccionPanel>
                            </div>

                            {/* ── Columna lateral ── */}
                            <div className="space-y-6 min-w-0">
                                <SeccionPanel titulo="Cruce por EPI" detalle="Carga y resultado de cada unidad">
                                    <MapaCalor columnas={columnasCruce} filas={filasCruce} />
                                </SeccionPanel>

                                <SeccionPanel titulo="Reglas del dictamen" detalle="Qué puede hacer el revisor">
                                    <ul className="space-y-3">
                                        {[
                                            { icono: CheckCircle2, color: ACENTOS.teal, titulo: 'Aprobar', texto: 'Remite el documento al Comando General.' },
                                            { icono: AlertTriangle, color: ACENTOS.ambar, titulo: 'Observar', texto: 'Devuelve el trámite al Secretario de la EPI para corrección.' },
                                            { icono: Lock, color: ACENTOS.steel, titulo: 'No editar', texto: 'El PDF y el texto del memorándum quedan intactos.' },
                                        ].map((r) => (
                                            <li key={r.titulo} className="flex items-start gap-3">
                                                <span
                                                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                                    style={{ background: alfa(r.color, 0.1), color: r.color }}
                                                    aria-hidden="true"
                                                >
                                                    <r.icono size={14} strokeWidth={2} />
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="block text-[12px] font-black text-[#14181a]">{r.titulo}</span>
                                                    <span className="block text-[11px] text-[#5a615f] mt-0.5">{r.texto}</span>
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </SeccionPanel>

                                <SeccionPanel titulo="Accesos rápidos">
                                    <div className="space-y-2">
                                        <AccionRapida LinkComponent={Link} to="/comando-departamental/observaciones" detalle="Seguimiento de devoluciones" label="Bandeja de observados" icono={<AlertTriangle size={15} />} />
                                        <AccionRapida LinkComponent={Link} to="/comando-departamental/desempenio" detalle="Ranking y analítica de las 9 EPIs" label="Desempeño y estadísticas" icono={<TrendingUp size={15} />} />
                                        <AccionRapida LinkComponent={Link} to="/comando-departamental/documentos-epi" detalle="Documentos por unidad" label="Documentos por EPI" icono={<FolderOpen size={15} />} />
                                        <AccionRapida LinkComponent={Link} to="/comando-departamental/reportes" detalle="Informes comparativos" label="Reportes" icono={<BarChart3 size={15} />} />
                                        <AccionRapida LinkComponent={Link} to="/comando-departamental/historial" detalle="Movimientos de estado" label="Historial" icono={<History size={15} />} />
                                    </div>
                                </SeccionPanel>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </LayoutComandoDepartamental>
    );
}
