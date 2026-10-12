/**
 * Dashboard — Inicio del Comando General (rol 3) · ESTRATÉGICO / INSTITUCIONAL
 *
 * Datos: UNA petición ligera a /api/panel/general (conteos, las 9 EPIs, tipos
 * de trámite y 5 documentos recientes con columnas mínimas).
 *
 * Identidad: teal institucional (nivel nacional). Se elimina la métrica
 * inventada "Tiempo Prom." que mostraba un valor fijo; ahora se muestran
 * indicadores calculados sobre datos reales.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import LayoutComandoGeneral from '../../js/components/LayoutComandoGeneral';
import EstadoBadge from '../../js/components/ui/EstadoBadge';
import Alert from '../../js/components/ui/Alert';
import {
    KpiPanel, SeccionPanel, BarrasPanel, AnilloPanel,
    SkeletonPanel, AccionRapida, ACENTOS,
} from '../../js/components/ui/Panel';
import { BandaEstados, ComparativaEntidades, ChipsDato } from '../../js/components/ui/Graficos';
import { COLOR_ESTADO, ORDEN_ESTADOS } from '../../js/constants/ofbol';
import { ChipEnVivo, useSyncGlobal } from '../../js/components/ui/ToastEnVivo';
import api from '../../js/lib/api';
import {
    UploadCloud, CheckCircle2, Undo2, Layers, Inbox,
    TrendingUp, Users, ScrollText, FileText, ArrowRight,
} from 'lucide-react';

export default function Dashboard() {
    const { conectado } = useSyncGlobal();
    const [panel, setPanel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const cargar = useCallback(async (silencioso = false) => {
        try {
            if (!silencioso) setLoading(true);
            const res = await api.get('/panel/general');
            if (res) setPanel(res);
        } catch {
            setError('Error al sincronizar con el servidor.');
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
    const porTipo = (panel?.por_tipo ?? []).map((t) => ({ label: t.nombre, total: t.total }));
    const porEstado = (panel?.por_estado ?? [])
        .map((e) => ({ label: e.estado, total: e.total, color: COLOR_ESTADO[e.estado] ?? ACENTOS.steel }))
        .toSorted((a, b) => {
            const ia = ORDEN_ESTADOS.indexOf(a.label);
            const ib = ORDEN_ESTADOS.indexOf(b.label);
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        });
    const recientes = panel?.recientes ?? [];

    const enCurso = recientes.filter((d) => (d.estado_actual ?? 0) < 6).length;

    return (
        <LayoutComandoGeneral>
            <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 ofbol-page-enter">
                {/* ── Encabezado ── */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="ofbol-badge ofbol-badge--teal">Instancia Máxima</span>
                            <span className="text-xs text-slate-400">· Dirección Nacional de Personal</span>
                            <ChipEnVivo conectado={conectado} />
                        </div>
                        <h1 className="ofbol-display heading-balance">Panel general de supervisión</h1>
                        <p className="ofbol-nota mt-2">
                            Visión institucional del flujo documental policial y del registro oficial del escalafón.
                        </p>
                    </div>
                    <Link to="/comando-general/documentos" className="ofbol-btn-primary ofbol-sheen self-start sm:self-auto">
                        <Inbox size={15} /> Bandeja de validación ({resumen.por_validar ?? 0})
                    </Link>
                </div>

                {error && <Alert type="warning" onClose={() => setError(null)}>{error}</Alert>}

                {loading ? <SkeletonPanel /> : (
                    <>
                        {/* ── KPIs ── */}
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 ofbol-stagger">
                            <KpiPanel etiqueta="Por validar" valor={resumen.por_validar ?? 0} sub="aprobados por el C. Dptal." icono={<UploadCloud size={15} strokeWidth={1.9} />} acento={ACENTOS.ambar} />
                            <KpiPanel etiqueta="Registrados" valor={resumen.registrados ?? 0} sub="flujo cerrado oficial" icono={<CheckCircle2 size={15} strokeWidth={1.9} />} acento={ACENTOS.teal} />
                            <KpiPanel etiqueta="Devueltos" valor={resumen.observados ?? 0} sub="en subsanación" icono={<Undo2 size={15} strokeWidth={1.9} />} acento={ACENTOS.crimson} />
                            <KpiPanel etiqueta="Recibidos hoy" valor={resumen.hoy ?? 0} sub="entradas del día" icono={<TrendingUp size={15} strokeWidth={1.9} />} acento={ACENTOS.olivaClaro} />
                            <div className="ofbol-card p-5 flex items-center gap-4">
                                <AnilloPanel porcentaje={resumen.tasa_cierre ?? 0} etiqueta="tasa de cierre" acento={ACENTOS.teal} size={92} />
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Total</p>
                                    <p className="text-2xl font-black tabular-nums text-[#0a0f0d] leading-none mt-1">{resumen.total ?? 0}</p>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1">memorándums</p>
                                </div>
                            </div>
                        </div>

                        {/* ── Analítica ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            <SeccionPanel
                                titulo="Actividad por unidad policial"
                                detalle="Volumen y estado de trámites por EPI"
                                className="lg:col-span-7"
                                accion={
                                    <Link to="/comando-general/comparativo" className="text-[11px] font-black uppercase tracking-wide shrink-0" style={{ color: ACENTOS.teal }}>
                                        Comparativo →
                                    </Link>
                                }
                            >
                                {/* Cada EPI es una barra apilada por resultado: la
                                    altura es el volumen y el color dice la calidad. */}
                                <ComparativaEntidades
                                    ariaLabel="Volumen y composición de trámites por EPI"
                                    filas={porEpi.slice(0, 7).map((e) => ({
                                        id: e.id_epi,
                                        nombre: e.nombre,
                                        total: e.total,
                                        segmentos: [
                                            { label: 'Registrados', total: e.registrados ?? 0, color: ACENTOS.teal },
                                            { label: 'Pendientes', total: e.pendientes ?? 0, color: ACENTOS.ambar },
                                            { label: 'Observados', total: e.observados ?? 0, color: ACENTOS.crimson },
                                            {
                                                label: 'En proceso',
                                                total: Math.max(
                                                    0,
                                                    (e.total ?? 0) - (e.registrados ?? 0) - (e.pendientes ?? 0) - (e.observados ?? 0),
                                                ),
                                                color: ACENTOS.olivaClaro,
                                            },
                                        ],
                                    }))}
                                    columnas={[
                                        { label: 'Registrados', color: ACENTOS.teal },
                                        { label: 'Pendientes', color: ACENTOS.ambar },
                                        { label: 'Observados', color: ACENTOS.crimson },
                                        { label: 'En proceso', color: ACENTOS.olivaClaro },
                                    ]}
                                />
                            </SeccionPanel>

                            <div className="lg:col-span-5 space-y-6">
                                <SeccionPanel titulo="Tipos de trámite frecuentes" detalle="Distribución por categoría">
                                    <BarrasPanel datos={porTipo.slice(0, 6)} claveLabel="label" claveValor="total" acento={ACENTOS.teal} />
                                </SeccionPanel>
                                <SeccionPanel titulo="Estado del flujo" detalle="Situación institucional">
                                    <BandaEstados datos={porEstado} grande />
                                </SeccionPanel>
                            </div>
                        </div>

                        {/* ── Recientes ── */}
                        <SeccionPanel
                            titulo="Trámites recientes en la bandeja"
                            detalle="Últimos documentos ingresados para validación o archivo"
                            accion={
                                <Link to="/comando-general/documentos" className="text-[11px] font-black uppercase tracking-wide shrink-0" style={{ color: ACENTOS.teal }}>
                                    Ver todos ({resumen.total ?? 0}) →
                                </Link>
                            }
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {recientes.map((d) => (
                                    <div
                                        key={d.id_documento}
                                        className="ofbol-card p-4 flex flex-col justify-between gap-3"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-mono text-[11.5px] font-black text-[#0a0f0d]">{d.codigo_documento}</span>
                                                <EstadoBadge nombre={d.estado?.nombre || 'En trámite'} />
                                            </div>
                                            <p className="text-[12px] font-bold text-slate-800 mt-2 line-clamp-1 leading-snug">{d.referencia}</p>
                                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                                                {d.oficial?.grado?.abreviatura ? `${d.oficial.grado.abreviatura} ` : ''}
                                                {d.oficial?.nombres} {d.oficial?.apellidos}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between gap-2 text-[10px] pt-2" style={{ borderTop: '1px solid #e3dfd6' }}>
                                            <span className="font-bold text-[#5a615f] truncate">{d.epi?.nombre}</span>
                                            <Link
                                                to="/comando-general/documentos"
                                                className="inline-flex items-center gap-1 font-black shrink-0"
                                                style={{ color: ACENTOS.teal }}
                                            >
                                                Gestionar <ArrowRight size={11} strokeWidth={2.4} aria-hidden="true" />
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </SeccionPanel>

                        {/* ── Accesos institucionales ── */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <AccionRapida LinkComponent={Link} to="/comando-general/tipos-memo" destacada label="Tipos de memorándum" detalle="Formatos, patrones y validaciones" icono={<Layers size={15} />} />
                            <AccionRapida LinkComponent={Link} to="/comando-general/registro" label="Registro documental" detalle="Libro oficial del archivo central" icono={<FileText size={15} />} />
                            <AccionRapida LinkComponent={Link} to="/comando-general/usuarios" label="Gestión de usuarios" detalle="Cuentas y credenciales" icono={<Users size={15} />} />
                            <AccionRapida LinkComponent={Link} to="/comando-general/auditoria" label="Registro de actividad" detalle="Auditoría institucional" icono={<ScrollText size={15} />} />
                        </div>

                        {enCurso > 0 && (
                            <div className="ofbol-card p-4 flex items-center justify-between gap-4 flex-wrap">
                                <ChipsDato
                                    datos={[
                                        { valor: enCurso, etiqueta: 'Siguen en curso' },
                                        { valor: recientes.length, etiqueta: 'Últimos recibidos' },
                                    ]}
                                />
                                <Link to="/comando-general/trazabilidad" className="ofbol-btn-ghost">
                                    Ver recorrido del trámite
                                    <ArrowRight size={13} strokeWidth={2.4} aria-hidden="true" />
                                </Link>
                            </div>
                        )}
                    </>
                )}
            </div>
        </LayoutComandoGeneral>
    );
}
