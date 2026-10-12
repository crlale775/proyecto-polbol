/**
 * ComparativoGeneral.jsx — Desempeño y Análisis Comparativo de EPIs
 * Comando General de la Policía Boliviana
 * Diseño gráfico, visual y limpio con ranking y barras de efectividad
 */
import React, { useState, useEffect, useMemo } from 'react';
import LayoutComandoGeneral from '../../js/components/LayoutComandoGeneral';
import Spinner from '../../js/components/ui/Spinner';
import { KpiPanel, ACENTOS } from '../../js/components/ui/Panel';
import { ChipsDato } from '../../js/components/ui/Graficos';
import api from '../../js/lib/api';

export default function ComparativoGeneral() {
    const [desempenio, setDesempenio] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [criterio, setCriterio] = useState('tasa');

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);
                const [desempenioRes, statsRes] = await Promise.all([
                    api.get('/desempenio-epis'),
                    api.get('/estadisticas-generales'),
                ]);
                if (Array.isArray(desempenioRes)) setDesempenio(desempenioRes);
                if (statsRes) setStats(statsRes);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const ordenados = useMemo(() => {
        return [...desempenio].toSorted((a, b) => {
            if (criterio === 'total') return b.metricas.total_documentos - a.metricas.total_documentos;
            if (criterio === 'registrados') return b.metricas.registrados - a.metricas.registrados;
            if (criterio === 'tasa') return b.metricas.tasa_aprobacion - a.metricas.tasa_aprobacion;
            return 0;
        });
    }, [desempenio, criterio]);

    return (
        <LayoutComandoGeneral>
            <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 ofbol-page-enter">

                {/* ─ Header PolBol ─ */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="ofbol-display heading-balance">Desempeño y efectividad por EPI</h1>
                        <p className="ofbol-nota mt-2">
                            Comparativa de las 9 estaciones de policía en volumen, cierre y efectividad.
                        </p>
                    </div>

                    <div
                        className="ofbol-card p-1.5 flex items-center gap-1 self-start sm:self-auto"
                        role="group"
                        aria-label="Criterio de orden"
                    >
                        {[
                            { id: 'tasa', label: 'Efectividad' },
                            { id: 'total', label: 'Volumen' },
                            { id: 'registrados', label: 'Registrados' },
                        ].map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                aria-pressed={criterio === c.id}
                                onClick={() => setCriterio(c.id)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                style={
                                    criterio === c.id
                                        ? { background: 'var(--ofbol-olive)', color: '#fbfaf6' }
                                        : { color: 'var(--ofbol-slate)' }
                                }
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="py-20 flex justify-center"><Spinner /></div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 ofbol-stagger">
                            <KpiPanel grande etiqueta="Total documentos" valor={stats?.total_documentos || 0} sub="En las 9 estaciones" acento={ACENTOS.oliva} />
                            <KpiPanel etiqueta="Registrados" valor={stats?.registrados || 0} sub="Cerrados oficialmente" acento={ACENTOS.teal} />
                            <KpiPanel etiqueta="En revisión" valor={stats?.en_revision || 0} sub="Flujo en curso" acento={ACENTOS.ambar} />
                            <KpiPanel etiqueta="Tasa global" valor={`${stats?.tasa_aprobacion || 0}%`} sub="Efectividad promedio" acento={ACENTOS.olivaClaro} />
                        </div>

                        {/* ─ Grid de Tarjetas de las 9 EPIs ─ */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {ordenados.map((epi, idx) => {
                                const tasa = epi.metricas.tasa_aprobacion;
                                const esTop = idx === 0;

                                return (
                                    <article
                                        key={epi.id_epi}
                                        className="ofbol-card p-5 space-y-4"
                                        style={esTop ? { borderColor: 'var(--ofbol-olive-muted)' } : undefined}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-[14px] flex items-center justify-center text-xs font-black ${
                                                    idx === 0
                                                        ? 'bg-amber-400 text-amber-950'
                                                        : idx === 1
                                                        ? 'bg-slate-300 text-slate-800'
                                                        : idx === 2
                                                        ? 'bg-amber-700 text-white'
                                                        : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                    #{idx + 1}
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-black text-slate-900 leading-tight">
                                                        {epi.nombre}
                                                    </h3>
                                                    <p className="text-[11px] text-slate-400">{epi.ubicacion || 'La Paz'}</p>
                                                </div>
                                            </div>

                                            {/* Indicador % */}
                                            <div className="text-right">
                                                <span className="text-lg font-black text-emerald-700 font-mono">
                                                    {tasa}%
                                                </span>
                                                <p className="text-[9px] font-bold uppercase text-slate-400">efectividad</p>
                                            </div>
                                        </div>

                                        <div className="ofbol-progress">
                                            <div className="ofbol-progress-bar" style={{ width: `${Math.max(tasa, 5)}%` }} />
                                        </div>

                                        <ChipsDato
                                            datos={[
                                                { etiqueta: 'Total', valor: epi.metricas.total_documentos },
                                                { etiqueta: 'Registrados', valor: epi.metricas.registrados },
                                                { etiqueta: 'Observados', valor: epi.metricas.observados, color: 'var(--ofbol-crimson)' },
                                            ]}
                                        />

                                        {/* Secretario */}
                                        {epi.secretario && (
                                            <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--ofbol-line)' }}>
                                                <span className="text-[11px] font-semibold truncate max-w-[160px]" style={{ color: 'var(--ofbol-ink)' }}>
                                                    {epi.secretario.usuario}
                                                </span>
                                                <span className="ofbol-badge ofbol-badge--teal">Activo</span>
                                            </div>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </LayoutComandoGeneral>
    );
}
