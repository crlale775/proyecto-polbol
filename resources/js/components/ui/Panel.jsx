/**
 * Panel.jsx — Primitivas visuales de los Dashboards (los 3 roles).
 *
 * Todo es CSS/SVG puro: sin librerías de gráficos, sin coste de hidratación
 * pesada. Los tres paneles comparten estas piezas para mantener una identidad
 * visual coherente y una carga instantánea.
 *
 * Reglas de oficio aplicadas (skill `craft`):
 *   R1 sin gradientes decorativos · R2 sin halos de color
 *   R4 una cifra líder por panel, el resto en peso secundario
 *   R10 estructura con borde; la sombra queda para lo que flota
 */
import React from 'react';
import { COLOR_ESTADO } from '../../constants/ofbol';
import { alfa } from './Graficos';

/* Paleta institucional OFBOL (nada de colores "genéricos de IA") */
export const ACENTOS = {
    oliva: '#3d4a2c',
    olivaClaro: '#8a9a6d',
    ambar: '#9a6f0a',
    teal: '#1a5c52',
    crimson: '#8f2020',
    steel: '#495456',
    rust: '#8b4513',
};

export const SERIE = [
    '#3d4a2c', '#9a6f0a', '#1a5c52', '#8b4513', '#5a6b3d',
    '#8f2020', '#495456', '#8a9a6d', '#a4b287', '#6d7d4f',
];

/** El color de un estado, desde la fuente única de verdad. */
export function colorEstado(nombre, respaldo = ACENTOS.steel) {
    return COLOR_ESTADO[nombre] || respaldo;
}

/**
 * KpiPanel — indicador con etiqueta, cifra y nota.
 * `grande` marca la cifra líder del panel; úsalo una sola vez por pantalla.
 */
export function KpiPanel({ etiqueta, valor, sub, acento = ACENTOS.oliva, icono, loading = false, grande = false }) {
    return (
        <div className="ofbol-kpi">
            <div className="ofbol-kpi-cabecera">
                <p className="ofbol-etiqueta truncate">{etiqueta}</p>
                {icono && (
                    <span className="ofbol-kpi-icono" style={{ background: alfa(acento, 0.09), color: acento }} aria-hidden="true">
                        {icono}
                    </span>
                )}
            </div>
            <p className={grande ? 'ofbol-cifra' : 'ofbol-cifra-sm'}>
                {loading ? <span className="ofbol-skeleton inline-block w-10 h-6 rounded" /> : valor}
            </p>
            {sub && <p className="ofbol-kpi-pie">{sub}</p>}
        </div>
    );
}

/** Encabezado de sección consistente (título + detalle + acción). */
export function SeccionPanel({ titulo, detalle, accion, children, className = '' }) {
    return (
        <section className={`ofbol-card p-5 ${className}`}>
            <header className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                    <h2 className="ofbol-titulo-seccion">{titulo}</h2>
                    {detalle && <p className="ofbol-kpi-pie mt-1">{detalle}</p>}
                </div>
                {accion}
            </header>
            {children}
        </section>
    );
}

/** Barras horizontales (magnitudes con porcentaje). */
export function BarrasPanel({ datos, claveLabel, claveValor = 'total', acento, max }) {
    if (!datos?.length) {
        return <p className="ofbol-vacio-nota">Sin datos para mostrar.</p>;
    }
    const tope = max || datos[0]?.[claveValor] || 1;
    const total = datos.reduce((a, d) => a + (d[claveValor] ?? 0), 0) || 1;

    return (
        <div className="space-y-3">
            {datos.map((d, i) => (
                <div key={`${d[claveLabel]}-${i}`} className="min-w-0">
                    <div className="flex justify-between items-baseline gap-2 mb-1">
                        <span className="text-[11.5px] font-bold text-[#3f4849] truncate">{d[claveLabel]}</span>
                        <span className="text-[11.5px] font-black tabular-nums text-[#14181a] shrink-0">
                            {d[claveValor]}
                            <span className="text-[#969b98] font-bold"> · {(((d[claveValor] ?? 0) / total) * 100).toFixed(0)}%</span>
                        </span>
                    </div>
                    <div className="ofbol-progress">
                        <div
                            className="ofbol-progress-bar"
                            style={{
                                width: `${Math.max(((d[claveValor] ?? 0) / tope) * 100, 3)}%`,
                                background: acento || SERIE[i % SERIE.length],
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

/** Donut SVG con leyenda lateral. */
export function DonutPanel({ datos, size = 132, thickness = 17 }) {
    const total = (datos ?? []).reduce((s, d) => s + d.total, 0);
    if (total === 0) {
        return <p className="ofbol-vacio-nota">Sin documentos por estado.</p>;
    }
    const r = (size - thickness) / 2;
    const c = 2 * Math.PI * r;
    let offset = 0;

    return (
        <div className="flex items-center gap-5 flex-wrap">
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="shrink-0"
                role="img"
                aria-label={datos.map((d) => `${d.label}: ${d.total}`).join('. ')}
            >
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eae7df" strokeWidth={thickness} />
                {datos.map((d, i) => {
                    const dash = (d.total / total) * c;
                    const el = (
                        <circle
                            key={`${d.clave ?? d.estado ?? d.label ?? i}`}
                            cx={size / 2}
                            cy={size / 2}
                            r={r}
                            fill="none"
                            stroke={d.color || SERIE[i % SERIE.length]}
                            strokeWidth={thickness}
                            strokeDasharray={`${dash} ${c - dash}`}
                            strokeDashoffset={-offset}
                            transform={`rotate(-90 ${size / 2} ${size / 2})`}
                        />
                    );
                    offset += dash;
                    return el;
                })}
            </svg>
            <div className="space-y-1.5 min-w-0 flex-1">
                {datos.map((d, i) => (
                    <div key={`${d.clave ?? d.estado ?? d.label ?? i}`} className="flex items-center gap-2 text-[11px] min-w-0">
                        <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: d.color || SERIE[i % SERIE.length] }} aria-hidden="true" />
                        <span className="text-[#3f4849] truncate flex-1">{d.label ?? d.estado}</span>
                        <span className="font-black text-[#14181a] tabular-nums shrink-0">{d.total}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Serie mensual en barras verticales (CSS puro). */
export function BarrasVerticales({ datos, claveLabel = 'label', claveValor = 'value', acento = ACENTOS.oliva }) {
    const max = Math.max(...(datos ?? []).map((d) => d[claveValor] ?? 0), 1);
    if (!datos?.length) return <p className="ofbol-vacio-nota">Sin serie mensual.</p>;

    return (
        <div className="flex items-end gap-1.5 h-32" aria-hidden="true">
            {datos.map((d, i) => (
                <div key={`${d[claveLabel]}-${i}`} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <span className="text-[9px] font-black text-[#5a615f] tabular-nums">{(d[claveValor] ?? 0) > 0 ? d[claveValor] : ''}</span>
                    <div
                        className="w-full rounded-t-[4px]"
                        style={{
                            height: `${Math.max(((d[claveValor] ?? 0) / max) * 100, 4)}%`,
                            background: acento,
                        }}
                    />
                    <span className="text-[9px] text-[#969b98] truncate w-full text-center">{d[claveLabel]}</span>
                </div>
            ))}
        </div>
    );
}

/**
 * AnilloPanel — tasa de cierre.
 * Se reserva para tasas reales (un porcentaje calculado), no como adorno:
 * junto a las barras y bandas que ya muestran el volumen.
 */
export function AnilloPanel({ porcentaje, etiqueta = 'cierre', acento = ACENTOS.teal, size = 116 }) {
    const pct = Math.max(0, Math.min(100, Number(porcentaje) || 0));
    const grosor = 11;
    const r = (size - grosor) / 2;
    const c = 2 * Math.PI * r;

    return (
        <div className="flex flex-col items-center">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${pct}% de ${etiqueta}`}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eae7df" strokeWidth={grosor} />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={acento}
                    strokeWidth={grosor}
                    strokeLinecap="round"
                    strokeDasharray={`${(pct / 100) * c} ${c}`}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            </svg>
            <div className="mt-3 text-center">
                <p className="ofbol-cifra-sm" style={{ color: acento }}>{pct}%</p>
                <p className="ofbol-etiqueta mt-1">{etiqueta}</p>
            </div>
        </div>
    );
}

/** Esqueleto de panel (evita saltos de layout mientras carga). */
export function SkeletonPanel() {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[0, 1, 2, 3, 4].map((i) => <div key={i} className="ofbol-skeleton h-[104px] rounded-[14px]" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 ofbol-skeleton h-64 rounded-[14px]" />
                <div className="ofbol-skeleton h-64 rounded-[14px]" />
            </div>
        </div>
    );
}

/** Fila de acceso rápido (acción de navegación). */
export function AccionRapida({ to, icono, label, detalle, destacada = false, LinkComponent }) {
    const Link = LinkComponent;
    return (
        <Link
            to={to}
            className="ofbol-lift flex items-center gap-3 p-3 rounded-xl"
            style={destacada
                ? { background: ACENTOS.oliva, border: '1px solid #2f3a21', color: '#fbfaf6' }
                : { background: 'transparent', border: '1px solid #e3dfd6', color: '#14181a' }}
        >
            <span
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{
                    background: destacada ? 'rgba(255,255,255,0.14)' : alfa(ACENTOS.oliva, 0.07),
                    color: destacada ? '#fbfaf6' : ACENTOS.oliva,
                }}
                aria-hidden="true"
            >
                {icono}
            </span>
            <span className="min-w-0">
                <span className="block text-[12.5px] font-bold leading-tight truncate">{label}</span>
                {detalle && (
                    <span className="block text-[10.5px] mt-0.5 truncate" style={{ color: destacada ? 'rgba(255,255,255,0.62)' : '#5a615f' }}>
                        {detalle}
                    </span>
                )}
            </span>
        </Link>
    );
}
