/**
 * ReportesEngine — Motor de reportes OFBOL con conjuntos DIFERENTES por rol.
 *
 * Cada nivel de mando tiene sus propios tipos de reporte (no comparten menú):
 *
 *   alcance="unidad" → Secretaría EPI · foco OPERATIVO (solo su EPI)
 *       · Resumen de mi EPI  · Mis tipos de trámite
 *       · Personal de mi EPI · Actividad diaria
 *
 *   alcance="departamental" → Comando Departamental · foco COMPARATIVO (9 EPIs)
 *       · Resumen departamental · Ranking de EPIs
 *       · Calidad y observaciones · Carga por secretaría
 *       · Tipos de memorándum
 *
 *   alcance="nacional" → Comando General · foco ESTRATÉGICO / INSTITUCIONAL
 *       · Panorama nacional · Comparativo por EPI
 *       · Escalafón por grado · Tipologías institucionales
 *       · Flujo documental
 *
 * Datos: una sola llamada a /api/metricas/reportes (cacheada 60 s en el backend)
 * que devuelve todas las agregaciones; cada sección renderiza solo lo suyo.
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { FileText } from 'lucide-react';
/* Gráficos propios (SVG/CSS): sustituyen a la librería de gráficos, así que
   las pantallas de reportes ya no descargan su trozo de ~120 kB gzip. */
import {
    GraficoLineas, GraficoColumnas, ComparativaEntidades, EstadoVacio,
} from '../../../js/components/ui/Graficos';
import { KpiPanel, DonutPanel, AnilloPanel } from '../../../js/components/ui/Panel';
import { COLOR_ESTADO } from '../../../js/constants/ofbol';
import LayoutSecretario from '../../../js/components/LayoutSecretario';
import LayoutComandoDepartamental from '../../../js/components/LayoutComandoDepartamental';
import LayoutComandoGeneral from '../../../js/components/LayoutComandoGeneral';
import AvatarFoto from '../../../js/components/ui/AvatarFoto';
import Alert from '../../../js/components/ui/Alert';
import { useAuth } from '../../../js/context/AuthContext';
import api from '../../../js/lib/api';

/* ────────────────────────── Paleta institucional OFBOL ────────────────── */

const OLIVA = ['#33401f', '#3d4a2c', '#4a5a35', '#5a6b3d', '#6d7d4f', '#8a9a6d', '#a4b287', '#c1c9a6'];
const ACENTO = { amber: '#9a6f0a', teal: '#1a5c52', steel: '#495456', rust: '#8b4513', crimson: '#8f2020' };
const SERIES = ['#3d4a2c', '#9a6f0a', '#1a5c52', '#8b4513', '#5a6b3d', '#8f2020', '#495456', '#8a9a6d', '#a4b287', '#6d7d4f'];

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const mesLargo = (clave) => {
    const [anio, mes] = String(clave).split('-');
    return `${MESES_LARGOS[Number(mes) - 1] ?? mes} ${anio}`;
};
const diaCorto = (clave) => {
    const [, mes, dia] = String(clave).split('-');
    return `${Number(dia)} ${MES_CORTO[Number(mes) - 1] ?? mes}`;
};

/* ────────────────────────── Primitivas visuales ────────────────────────── */

function Skeleton({ className = '' }) {
    return <div className={`ofbol-skeleton rounded-lg ${className}`} />;
}

function TarjetaGrafica({ titulo, detalle, children, className = '' }) {
    return (
        <section className={`ofbol-card p-6 print:break-inside-avoid ${className}`}>
            <header className="mb-5">
                <h2 className="text-[13px] font-black uppercase tracking-[0.06em] text-[#0a0f0d]">{titulo}</h2>
                {detalle && <p className="text-[11px] text-slate-500 mt-0.5">{detalle}</p>}
            </header>
            {children}
        </section>
    );
}

function MetricaClave({ etiqueta, valor, sub, acento }) {
    return <KpiPanel etiqueta={etiqueta} valor={valor} sub={sub} acento={acento ?? 'var(--ofbol-olive)'} />;
}

/** Apilado de resultados por entidad: la altura es el volumen,
    el color dice la calidad. Un gráfico en lugar de una tabla larga. */
function apilarResultados(filas, claveNombre, conEnProceso) {
    return filas.map((f) => {
        const aprobados = f.aprobados ?? 0;
        const observados = f.observados ?? 0;
        const enProceso = conEnProceso && f.en_proceso != null
            ? f.en_proceso
            : Math.max(0, (f.total ?? 0) - aprobados - observados);
        return {
            id: f.id_epi ?? f[claveNombre],
            label: f[claveNombre],
            nombre: f[claveNombre],
            total: f.total ?? 0,
            valores: [aprobados, observados, enProceso],
            segmentos: [
                { label: 'Aprobados', total: aprobados, color: '#3d4a2c' },
                { label: 'Observados', total: observados, color: '#9a6f0a' },
                { label: 'En proceso', total: enProceso, color: '#8a9a6d' },
            ],
        };
    });
}

const SERIES_RESULTADO = [
    { label: 'Aprobados', color: '#3d4a2c' },
    { label: 'Observados', color: '#9a6f0a' },
    { label: 'En proceso', color: '#8a9a6d' },
];

function Vacio({ mensaje = 'Sin datos para el período seleccionado.' }) {
    return (
        <div className="ofbol-card">
            <EstadoVacio
                icono={FileText}
                titulo={mensaje}
                nota="Ampliá el rango de fechas o quitá los filtros."
            />
        </div>
    );
}

/** Barras horizontales (listas de magnitud) reutilizadas por las 3 vistas. */
function BarrasHorizontales({ datos, claveLabel, claveValor = 'total', formatear, colorInicio = 0 }) {
    const max = datos[0]?.[claveValor] || 1;
    const total = datos.reduce((a, d) => a + (d[claveValor] ?? 0), 0) || 1;
    return (
        <div className="space-y-3.5">
            {datos.map((d, i) => (
                <div key={`${d[claveLabel]}-${i}`}>
                    <div className="flex justify-between items-baseline mb-1 gap-2">
                        <span className="text-[12px] font-bold text-[#3f4849] truncate">{d[claveLabel]}</span>
                        <span className="text-[12px] font-black tabular-nums text-[#0a0f0d] shrink-0 ml-2">
                            {formatear ? formatear(d) : d[claveValor]}
                            <span className="text-slate-400 font-bold"> · {total > 0 ? (((d[claveValor] ?? 0) / total) * 100).toFixed(1) : 0}%</span>
                        </span>
                    </div>
                    <div className="ofbol-progress">
                        <div
                            className="ofbol-progress-bar"
                            style={{
                                width: `${Math.max(((d[claveValor] ?? 0) / max) * 100, 4)}%`,
                                background: OLIVA[(i + colorInicio) % OLIVA.length],
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

/** Ranking de personas (oficiales / secretarios) con avatar. */
function RankingPersonas({ personas, max, acentoObservados = true }) {
    const tope = max || personas[0]?.total || 1;
    return (
        <div className="space-y-4">
            {personas.map((o, i) => (
                <div key={o.id_oficial ?? o.id_usuario ?? i} className="flex items-center gap-3">
                    <span
                        className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 tabular-nums"
                        style={i === 0
                            ? { background: 'rgba(154,111,10,0.18)', color: ACENTO.amber }
                            : i < 3
                                ? { background: 'rgba(154,111,10,0.1)', color: ACENTO.amber }
                                : { background: 'rgba(61,74,44,0.08)', color: '#5a615f' }}
                    >
                        {i + 1}
                    </span>
                    <AvatarFoto
                        foto={o.foto}
                        nombre={`${o.nombres ?? o.usuario ?? ''} ${o.apellidos ?? ''}`}
                        iniciales={`${(o.nombres ?? o.usuario ?? 'U')[0]}${o.apellidos?.[0] ?? ''}`}
                        className="w-9 h-9 rounded-lg text-[11px]"
                        fallbackClassName="bg-gradient-to-b from-[#5a6b3d] to-[#3d4a2c]"
                        ring
                    />
                    <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-[#0a0f0d] truncate">
                            {o.grado && <span className="text-[#3d4a2c] font-black">{o.grado} </span>}
                            {o.nombres ?? o.usuario} {o.apellidos ?? ''}
                        </p>
                        <div className="ofbol-progress mt-1.5">
                            <div className="ofbol-progress-bar" style={{ width: `${Math.max((o.total / tope) * 100, 6)}%` }} />
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-[13px] font-black tabular-nums text-[#0a0f0d]">{o.total}</p>
                        {acentoObservados && (o.observados ?? 0) > 0 && (
                            <p className="text-[9px] font-bold" style={{ color: ACENTO.amber }}>{o.observados} obs.</p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

function TablaEpis({ porEpi }) {
    return (
        <div className="overflow-x-auto -mx-2">
            <table className="ofbol-table w-full">
                <thead>
                    <tr>
                        <th className="text-left">Estación (EPI)</th>
                        <th className="text-center">Total</th>
                        <th className="text-center">Aprobados</th>
                        <th className="text-center">Observados</th>
                        <th className="text-center">En proceso</th>
                        <th className="text-center">Tasa</th>
                    </tr>
                </thead>
                <tbody>
                    {porEpi.map((e) => (
                        <tr key={e.id_epi}>
                            <td className="font-bold text-[#0a0f0d]">{e.epi}</td>
                            <td className="text-center tabular-nums font-bold">{e.total}</td>
                            <td className="text-center tabular-nums" style={{ color: ACENTO.teal, fontWeight: 700 }}>{e.aprobados}</td>
                            <td className="text-center tabular-nums" style={{ color: ACENTO.amber, fontWeight: 700 }}>{e.observados}</td>
                            <td className="text-center tabular-nums" style={{ color: ACENTO.steel, fontWeight: 700 }}>{e.en_proceso}</td>
                            <td className="text-center">
                                <span className="ofbol-badge ofbol-badge--olive tabular-nums">
                                    {e.total > 0 ? `${((e.aprobados / e.total) * 100).toFixed(0)}%` : '—'}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/* ────────────────────────── Exportación CSV ────────────────────────── */

function descargarCsv(nombre, columnas, filas) {
    const escapar = (v) => {
        const s = String(v ?? '');
        return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lineas = [
        columnas.map((c) => escapar(c.titulo)).join(';'),
        ...filas.map((f) => columnas.map((c) => escapar(f[c.clave])).join(';')),
    ];
    const blob = new Blob([`\uFEFF${lineas.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
}

const COL_EPI = [
    { titulo: 'EPI', clave: 'epi' }, { titulo: 'Total', clave: 'total' },
    { titulo: 'Aprobados', clave: 'aprobados' }, { titulo: 'Observados', clave: 'observados' },
    { titulo: 'En proceso', clave: 'en_proceso' },
];
const COL_TIPO = [{ titulo: 'Tipo de documento', clave: 'tipo' }, { titulo: 'Trámites', clave: 'total' }];
const COL_ESTADO = [{ titulo: 'Estado', clave: 'estado' }, { titulo: 'Trámites', clave: 'total' }];
const COL_DIA = [{ titulo: 'Día', clave: 'dia' }, { titulo: 'Documentos', clave: 'total' }];
const COL_OFICIAL = [
    { titulo: 'Grado', clave: 'grado' }, { titulo: 'Oficial', clave: 'nombre' },
    { titulo: 'Trámites', clave: 'total' }, { titulo: 'Observados', clave: 'observados' },
];
const COL_GRADO = [{ titulo: 'Grado', clave: 'grado' }, { titulo: 'Trámites', clave: 'total' }];
const COL_SECRETARIO = [{ titulo: 'Secretaría', clave: 'usuario' }, { titulo: 'Trámites', clave: 'total' }];

const nombreOficial = (o) => ({ ...o, nombre: `${o.nombres ?? ''} ${o.apellidos ?? ''}`.trim() });

/** Exportación CSV específica por rol + tipo de reporte. */
function exportar(alcance, tipo, d) {
    const base = `ofbol_${alcance}_${tipo}`;
    if (alcance === 'unidad') {
        if (tipo === 'resumen') return descargarCsv(`${base}.csv`, COL_ESTADO, d.porEstado);
        if (tipo === 'tipos') return descargarCsv(`${base}.csv`, COL_TIPO, d.porTipo);
        if (tipo === 'oficiales') return descargarCsv(`${base}.csv`, COL_OFICIAL, d.topOficiales.map(nombreOficial));
        return descargarCsv(`${base}.csv`, COL_DIA, d.porDia);
    }
    if (alcance === 'departamental') {
        if (tipo === 'resumen') return descargarCsv(`${base}.csv`, COL_ESTADO, d.porEstado);
        if (tipo === 'ranking' || tipo === 'calidad') return descargarCsv(`${base}.csv`, COL_EPI, d.porEpi);
        if (tipo === 'secretarios') return descargarCsv(`${base}.csv`, COL_SECRETARIO, d.porSecretario);
        return descargarCsv(`${base}.csv`, COL_TIPO, d.porTipo);
    }
    // nacional
    if (tipo === 'resumen') return descargarCsv(`${base}.csv`, COL_ESTADO, d.porEstado);
    if (tipo === 'epis') return descargarCsv(`${base}.csv`, COL_EPI, d.porEpi);
    if (tipo === 'escalafon') return descargarCsv(`${base}.csv`, COL_GRADO, d.porGrado);
    if (tipo === 'tipologias') return descargarCsv(`${base}.csv`, COL_TIPO, d.porTipo);
    return descargarCsv(`${base}.csv`, COL_DIA, d.porDia);
}

/* ══════════════════════ Configuración por ROL ══════════════════════ */

const layoutPorAlcance = {
    unidad: LayoutSecretario,
    departamental: LayoutComandoDepartamental,
    nacional: LayoutComandoGeneral,
};

const ENCABEZADO = {
    unidad: {
        kicker: 'Reportes de la unidad',
        titulo: 'Reportes de mi EPI',
        detalle: 'Cifras operativas de la producción documental de esta estación policial integral.',
        chip: 'Ámbito: Unidad',
    },
    departamental: {
        kicker: 'Informes comparativos',
        titulo: 'Reportes Departamentales',
        detalle: 'Comparativo de las 9 EPIs de La Paz: volumen, calidad y desempeño por secretaría.',
        chip: 'Ámbito: Departamental',
    },
    nacional: {
        kicker: 'Consolidado estratégico',
        titulo: 'Reportes del Comando General',
        detalle: 'Visión institucional del sistema documental policial: tipologías, escalafón y flujo.',
        chip: 'Ámbito: Nacional',
    },
};

const TIPOS_POR_ALCANCE = {
    unidad: [
        { id: 'resumen', etiqueta: 'Resumen de mi EPI' },
        { id: 'tipos', etiqueta: 'Mis tipos de trámite' },
        { id: 'oficiales', etiqueta: 'Personal de mi EPI' },
        { id: 'diario', etiqueta: 'Actividad diaria' },
    ],
    departamental: [
        { id: 'resumen', etiqueta: 'Resumen departamental' },
        { id: 'ranking', etiqueta: 'Ranking de EPIs' },
        { id: 'calidad', etiqueta: 'Calidad y observaciones' },
        { id: 'secretarios', etiqueta: 'Carga por secretaría' },
        { id: 'tipos', etiqueta: 'Tipos de memorándum' },
    ],
    nacional: [
        { id: 'resumen', etiqueta: 'Panorama nacional' },
        { id: 'epis', etiqueta: 'Comparativo por EPI' },
        { id: 'escalafon', etiqueta: 'Escalafón por grado' },
        { id: 'tipologias', etiqueta: 'Tipologías institucionales' },
        { id: 'flujo', etiqueta: 'Flujo documental' },
    ],
};

/* ── Bloques compartidos que cada rol compone a su manera ── */

function BloqueResumenGlobal({ d, scopeLabel }) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 ofbol-stagger">
                <MetricaClave etiqueta="Total trámites" valor={d.resumen.total ?? 0} />
                <MetricaClave etiqueta="Aprobados" valor={d.resumen.aprobados ?? 0} sub={`${d.resumen.tasa_aprobacion ?? 0}% del total`} acento={ACENTO.teal} />
                <MetricaClave etiqueta="Observados" valor={d.resumen.observados ?? 0} sub={`${d.resumen.tasa_observacion ?? 0}% del total`} acento={ACENTO.amber} />
                <MetricaClave etiqueta="En proceso" valor={d.resumen.en_proceso ?? 0} sub={scopeLabel} acento={ACENTO.steel} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <TarjetaGrafica titulo="Estado del flujo documental" detalle="Distribución actual por estado" className="lg:col-span-5">
                    <DonutPanel
                        size={176}
                        thickness={22}
                        datos={d.porEstado.map((e, i) => ({
                            label: e.estado,
                            total: e.total,
                            color: COLOR_ESTADO[e.estado] || SERIES[i % SERIES.length],
                        }))}
                    />
                </TarjetaGrafica>

                <TarjetaGrafica titulo="Evolución mensual del flujo" detalle="Total emitido, aprobados y observados por mes" className="lg:col-span-7">
                    <GraficoLineas
                        altura={244}
                        categorias={d.porMes.map((m) => m.mesLargo)}
                        series={[
                            { label: 'Total emitido', color: '#3d4a2c', tipo: 'area', valores: d.porMes.map((m) => m.total) },
                            { label: 'Aprobados', color: '#1a5c52', tipo: 'area', valores: d.porMes.map((m) => m.aprobados) },
                            { label: 'Observados', color: '#9a6f0a', tipo: 'linea', valores: d.porMes.map((m) => m.observados) },
                        ]}
                    />
                </TarjetaGrafica>
            </div>
        </div>
    );
}

function BloqueTipos({ d, titulo, detalle }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <TarjetaGrafica titulo={titulo} detalle={detalle} className="lg:col-span-7">
                <ComparativaEntidades
                    filas={d.porTipo.map((t, i) => ({
                        label: t.tipo,
                        nombre: t.tipo,
                        total: t.total,
                        segmentos: [{ label: t.tipo, total: t.total, color: OLIVA[i % OLIVA.length] }],
                    }))}
                    ariaLabel={`Trámites por tipo: ${d.porTipo.map((t) => `${t.tipo} ${t.total}`).join('. ')}`}
                />
            </TarjetaGrafica>
            <TarjetaGrafica titulo="Participación por tipo" detalle="Peso relativo de cada tipo en el total" className="lg:col-span-5">
                <DonutPanel
                    size={168}
                    thickness={21}
                    datos={d.porTipo.map((t, i) => ({ label: t.tipo, total: t.total, color: OLIVA[i % OLIVA.length] }))}
                />
            </TarjetaGrafica>
        </div>
    );
}

function BloqueEvolucionDiaria({ d, titulo }) {
    return (
        <TarjetaGrafica titulo={titulo} detalle="Documentos ingresados por día en los últimos 30 días">
            <GraficoLineas
                altura={264}
                categorias={d.porDia.map((x) => x.diaCorto)}
                series={[{ label: 'Documentos ingresados', color: '#3d4a2c', tipo: 'area', valores: d.porDia.map((x) => x.total) }]}
            />
        </TarjetaGrafica>
    );
}

function BloqueCargaGrados({ porGrado }) {
    return (
        <GraficoColumnas
            altura={216}
            mostrarTotal
            datos={porGrado.map((g) => ({ label: g.grado, valores: [g.total] }))}
            series={[{ label: 'Trámites', color: '#3d4a2c' }]}
        />
    );
}

/* ══════════════════════ Secciones específicas por ROL ══════════════════════ */

/* ── SECRETARÍA EPI (operativo) ── */

const SECCIONES = {
    unidad: {
        resumen: (d) => <BloqueResumenGlobal d={d} scopeLabel="en trámite de mi EPI" />,
        tipos: (d) => (
            <BloqueTipos d={d} titulo="Trámites emitidos por tipo" detalle={`Demanda de ${d.resumen.total ?? 0} trámites de mi unidad`} />
        ),
        oficiales: (d) => (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <TarjetaGrafica titulo="Carga por grado del personal" detalle="Distribución del trabajo según el grado" className="lg:col-span-5">
                    <BloqueCargaGrados porGrado={d.porGrado} />
                </TarjetaGrafica>
                <TarjetaGrafica titulo="Oficiales de mi EPI con más trámites" detalle="Ranking interno de productividad" className="lg:col-span-7">
                    {d.topOficiales.length === 0
                        ? <p className="text-xs text-slate-400 py-4 text-center">Sin trámites registrados.</p>
                        : <RankingPersonas personas={d.topOficiales} />}
                </TarjetaGrafica>
            </div>
        ),
        diario: (d) => {
            const dias = d.porDia.length;
            const totalDias = d.porDia.reduce((a, x) => a + x.total, 0);
            const pico = d.porDia.reduce((a, x) => (x.total > (a?.total ?? 0) ? x : a), null);
            return (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 ofbol-stagger">
                        <MetricaClave etiqueta="Promedio diario" valor={dias > 0 ? (totalDias / dias).toFixed(1) : 0} sub="documentos por día activo" />
                        <MetricaClave etiqueta="Día de mayor carga" valor={pico?.diaCorto ?? '—'} sub={pico ? `${pico.total} documentos` : ''} acento={ACENTO.amber} />
                        <MetricaClave etiqueta="Días con actividad" valor={dias} sub="en los últimos 30 días" acento={ACENTO.teal} />
                    </div>
                    <BloqueEvolucionDiaria d={d} titulo="Mi ritmo de emisión documental" />
                </div>
            );
        },
    },

    /* ── COMANDO DEPARTAMENTAL (comparativo) ── */

    departamental: {
        resumen: (d) => <BloqueResumenGlobal d={d} scopeLabel="pendientes de dictamen" />,
        ranking: (d) => (
            <div className="space-y-6">
                <TarjetaGrafica titulo="Comparativo de las 9 EPIs" detalle="Volumen total y resultado del flujo por estación">
                    <GraficoColumnas
                        apilado
                        altura={252}
                        mostrarTotal
                        datos={apilarResultados(d.porEpi, 'epi', true)}
                        series={SERIES_RESULTADO}
                    />
                </TarjetaGrafica>
                <TarjetaGrafica titulo="Detalle con tasas de calidad" detalle="Cuadro consolidado por estación policial">
                    <TablaEpis porEpi={d.porEpi} />
                </TarjetaGrafica>
            </div>
        ),
        calidad: (d) => {
            const observadosPorEpi = [...d.porEpi].sort((a, b) => b.observados - a.observados);
            const peores = [...d.topOficiales].sort((a, b) => (b.observados ?? 0) - (a.observados ?? 0)).filter((o) => (o.observados ?? 0) > 0);
            return (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 ofbol-stagger">
                        <MetricaClave etiqueta="Observados" valor={d.resumen.observados ?? 0} acento={ACENTO.amber} />
                        <MetricaClave etiqueta="Tasa de observación" valor={`${d.resumen.tasa_observacion ?? 0}%`} sub="sobre el total emitido" acento={ACENTO.amber} />
                        <MetricaClave etiqueta="Tasa de aprobación" valor={`${d.resumen.tasa_aprobacion ?? 0}%`} acento={ACENTO.teal} />
                        <MetricaClave etiqueta="EPIs con observados" valor={observadosPorEpi.filter((e) => e.observados > 0).length} sub="requieren seguimiento" acento={ACENTO.crimson} />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <TarjetaGrafica titulo="Observados por EPI" detalle="Estaciones con mayor índice de devolución" className="lg:col-span-7">
                            <BarrasHorizontales
                                datos={observadosPorEpi.map((e) => ({ ...e, label: e.epi }))}
                                claveLabel="label"
                                claveValor="observados"
                                colorInicio={1}
                            />
                        </TarjetaGrafica>
                        <TarjetaGrafica titulo="Oficiales con más observaciones" detalle="Seguimiento individual de la calidad documental" className="lg:col-span-5">
                            {peores.length === 0
                                ? <p className="text-xs text-slate-400 py-4 text-center">Sin observaciones registradas.</p>
                                : <RankingPersonas personas={peores} />}
                        </TarjetaGrafica>
                    </div>
                </div>
            );
        },
        secretarios: (d) => (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <TarjetaGrafica titulo="Ranking de secretarías" detalle="Trámites emitidos por cada secretaría EPI" className="lg:col-span-7">
                    {d.porSecretario.length === 0
                        ? <p className="text-xs text-slate-400 py-4 text-center">Sin actividad en el período.</p>
                        : <RankingPersonas personas={d.porSecretario} acentoObservados={false} />}
                </TarjetaGrafica>
                <TarjetaGrafica titulo="Tasa de aprobación del departamento" detalle="Calidad consolidada del período" className="lg:col-span-5">
                    <AnilloPanel porcentaje={d.resumen.tasa_aprobacion} etiqueta="aprobación" />
                    <p className="ofbol-nota text-center mt-4 mx-auto">
                        {d.resumen.aprobados ?? 0} aprobados sobre {d.resumen.total ?? 0} trámites emitidos.
                    </p>
                </TarjetaGrafica>
            </div>
        ),
        tipos: (d) => (
            <BloqueTipos d={d} titulo="Tipos de memorándum en el departamento" detalle="Demanda por tipo en las 9 EPIs de La Paz" />
        ),
    },

    /* ── COMANDO GENERAL (estratégico) ── */

    nacional: {
        resumen: (d) => (
            <div className="space-y-6">
                <BloqueResumenGlobal d={d} scopeLabel="en trámite institucional" />
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <TarjetaGrafica titulo="Efectividad institucional" detalle="Tasa de aprobación del sistema nacional" className="lg:col-span-5">
                        <AnilloPanel porcentaje={d.resumen.tasa_aprobacion} etiqueta="aprobación" />
                    </TarjetaGrafica>
                    <TarjetaGrafica titulo="Carga por grado (escalafón)" detalle="Distribución jerárquica de la demanda documental" className="lg:col-span-7">
                        <BloqueCargaGrados porGrado={d.porGrado} />
                    </TarjetaGrafica>
                </div>
            </div>
        ),
        epis: (d) => (
            <div className="space-y-6">
                <TarjetaGrafica titulo="Comparativo nacional por estación" detalle="Volumen y calidad por EPI en todo el país">
                    <GraficoColumnas
                        apilado
                        altura={252}
                        mostrarTotal
                        datos={apilarResultados(d.porEpi, 'epi', false)}
                        series={SERIES_RESULTADO}
                    />
                </TarjetaGrafica>
                <TarjetaGrafica titulo="Consolidado nacional" detalle="Cuadro de todas las estaciones con trámites">
                    <TablaEpis porEpi={d.porEpi} />
                </TarjetaGrafica>
            </div>
        ),
        escalafon: (d) => (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <TarjetaGrafica titulo="Trámites por grado del escalafón" detalle="Carga según la jerarquía del personal" className="lg:col-span-5">
                    <BloqueCargaGrados porGrado={d.porGrado} />
                </TarjetaGrafica>
                <TarjetaGrafica titulo="Oficiales con mayor carga documental" detalle="Ranking institucional del personal" className="lg:col-span-7">
                    {d.topOficiales.length === 0
                        ? <p className="text-xs text-slate-400 py-4 text-center">Sin registros.</p>
                        : <RankingPersonas personas={d.topOficiales} />}
                </TarjetaGrafica>
            </div>
        ),
        tipologias: (d) => (
            <BloqueTipos d={d} titulo="Tipologías de memorándum institucional" detalle="Tipos más utilizados en el sistema nacional" />
        ),
        flujo: (d) => (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7">
                    <BloqueEvolucionDiaria d={d} titulo="Pulso operativo institucional · 30 días" />
                </div>
                <div className="lg:col-span-5 space-y-6">
                    <TarjetaGrafica titulo="Estado del flujo" detalle="Distribución por estado a nivel nacional">
                        <BarrasHorizontales datos={d.porEstado} claveLabel="estado" />
                    </TarjetaGrafica>
                </div>
            </div>
        ),
    },
};

/* ═══════════════════════════ Motor principal ═══════════════════════════ */

export default function ReportesEngine({ alcance = 'unidad' }) {
    const { user } = useAuth();
    const Layout = layoutPorAlcance[alcance] ?? LayoutSecretario;
    const encabezado = ENCABEZADO[alcance] ?? ENCABEZADO.unidad;
    const tiposReporte = TIPOS_POR_ALCANCE[alcance] ?? TIPOS_POR_ALCANCE.unidad;
    const secciones = SECCIONES[alcance] ?? SECCIONES.unidad;

    const [metricas, setMetricas] = useState(null);
    const [epis, setEpis] = useState([]);
    const [cargandoCatalogo, setCargandoCatalogo] = useState(alcance !== 'unidad');
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(null);
    const [tipo, setTipo] = useState(tiposReporte[0].id);

    const [idEpi, setIdEpi] = useState('');
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');

    const esUnidad = alcance === 'unidad';

    // Catálogo de EPIs solo para los niveles departamental/nacional
    useEffect(() => {
        if (esUnidad) return undefined;
        let vivo = true;
        api.get('/epis')
            .then((r) => { if (vivo) setEpis(Array.isArray(r) ? r : []); })
            .catch(() => {})
            .finally(() => { if (vivo) setCargandoCatalogo(false); });
        return () => { vivo = false; };
    }, [esUnidad]);

    // Una sola carga de métricas (el backend cachea 60 s por firma de filtros)
    useEffect(() => {
        let vivo = true;
        async function cargar() {
            setCargando(true);
            try {
                const params = new URLSearchParams();
                const epi = esUnidad ? user?.id_epi : idEpi;
                if (epi) params.set('id_epi', epi);
                if (desde) params.set('desde', desde);
                if (hasta) params.set('hasta', hasta);
                const qs = params.toString();
                const res = await api.get(`/metricas/reportes${qs ? `?${qs}` : ''}`);
                if (vivo) { setMetricas(res); setError(null); }
            } catch {
                if (vivo) setError('No se pudieron cargar los datos del reporte.');
            } finally {
                if (vivo) setCargando(false);
            }
        }
        cargar();
        return () => { vivo = false; };
    }, [esUnidad, user?.id_epi, idEpi, desde, hasta]);

    // Cuerpo de datos normalizado (una sola vez por respuesta)
    const d = useMemo(() => ({
        resumen: metricas?.resumen ?? {},
        porEstado: metricas?.por_estado ?? [],
        porTipo: metricas?.por_tipo ?? [],
        porEpi: metricas?.por_epi ?? [],
        porMes: (metricas?.por_mes ?? []).map((m) => ({ ...m, mesLargo: mesLargo(m.mes) })),
        porGrado: metricas?.por_grado ?? [],
        topOficiales: metricas?.top_oficiales ?? [],
        porSecretario: metricas?.por_secretario ?? [],
        porDia: (metricas?.por_dia ?? []).map((x) => ({ ...x, diaCorto: diaCorto(x.dia) })),
        user,
    }), [metricas, user]);

    const hayDatos = (d.resumen.total ?? 0) > 0;
    const hayFiltros = (!esUnidad && idEpi) || desde || hasta;
    const Seccion = secciones[tipo];

    const handleExportar = useCallback(() => exportar(alcance, tipo, d), [alcance, tipo, d]);

    return (
        <Layout>
            <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 ofbol-page-enter">
                {/* ── Encabezado institucional ── */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                    <div>
                        <h1 className="ofbol-display">{encabezado.titulo}</h1>
                        <p className="ofbol-nota mt-2">{encabezado.detalle}</p>
                        <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                            <span className="ofbol-badge ofbol-badge--olive">{encabezado.chip}</span>
                            {esUnidad && user?.epi && <span className="text-[11px] font-bold text-slate-500">{user.epi}</span>}
                            {metricas?.generado_en && (
                                <span className="text-[10px] text-slate-400">
                                    · generado {new Date(metricas.generado_en).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' })}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 print:hidden">
                        <button type="button" onClick={handleExportar} disabled={!hayDatos} className="ofbol-btn-ghost" title="Descargar los datos de este reporte en CSV">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                            </svg>
                            CSV
                        </button>
                        <button type="button" onClick={() => window.print()} className="ofbol-btn-primary !py-2 !px-4 !text-[11px]">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            Imprimir / PDF
                        </button>
                    </div>
                </div>

                {error && <Alert type="error" onClose={() => setError(null)}>{error}</Alert>}

                {/* ── Selector de tipo de reporte (específico de cada rol) ── */}
                <div className="ofbol-card p-1.5 flex flex-wrap gap-1 print:hidden" role="tablist" aria-label="Tipo de reporte">
                    {tiposReporte.map((t) => {
                        const activo = tipo === t.id;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                role="tab"
                                aria-selected={activo}
                                onClick={() => setTipo(t.id)}
                                className="px-3.5 py-2 rounded-lg text-[11px] font-black uppercase tracking-[0.04em] transition-colors duration-200"
                                style={activo
                                    ? { background: '#3d4a2c', color: 'white' }
                                    : { color: '#5a615f', background: 'transparent' }}
                            >
                                {t.etiqueta}
                            </button>
                        );
                    })}
                </div>

                {/* ── Filtros (departamental / nacional) ── */}
                {!esUnidad && (
                    <div className="ofbol-card p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 print:hidden">
                        <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 shrink-0">Filtros</span>
                        <select
                            value={idEpi}
                            onChange={(e) => setIdEpi(e.target.value)}
                            className="ofbol-input !py-2 !text-xs sm:max-w-[240px]"
                            aria-label="Filtrar por estación policial"
                            disabled={cargandoCatalogo}
                        >
                            <option value="">Todas las EPIs</option>
                            {epis.map((e) => <option key={e.id_epi} value={e.id_epi}>{e.nombre}</option>)}
                        </select>
                        <div className="flex items-center gap-2 flex-1 sm:max-w-md">
                            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} max={hasta || undefined} className="ofbol-input !py-2 !text-xs w-full" aria-label="Fecha inicial" />
                            <span className="text-slate-400 text-xs">al</span>
                            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} min={desde || undefined} className="ofbol-input !py-2 !text-xs w-full" aria-label="Fecha final" />
                        </div>
                        {hayFiltros && (
                            <button
                                type="button"
                                onClick={() => { setIdEpi(''); setDesde(''); setHasta(''); }}
                                className="text-[11px] font-black uppercase tracking-wide text-[#3d4a2c] hover:underline"
                            >
                                Limpiar
                            </button>
                        )}
                    </div>
                )}

                {/* ── Contenido ── */}
                {cargando || cargandoCatalogo ? (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
                        </div>
                        <Skeleton className="w-full h-64" />
                    </div>
                ) : !hayDatos ? (
                    <Vacio />
                ) : (
                    <div key={`${alcance}-${tipo}`} className="ofbol-page-enter">
                        {Seccion ? <Seccion {...d} /> : <Vacio />}
                    </div>
                )}
            </div>
        </Layout>
    );
}
