/**
 * Graficos.jsx — Primitivas gráficas de OFBOL.
 *
 * Reemplazan bloques de texto por geometría vectorial nítida: recorridos
 * institucionales, líneas de tiempo, composición de estados, comparativas
 * entre EPIs y mapas de calor.
 *
 * Reglas de oficio que respetan (skill `craft` / `impeccable`):
 *   · Sin gradientes decorativos ni halos de color: el color es plano.
 *   · Sombra solo donde algo flota; acá todo es estructura, así que hay borde.
 *   · Cada gráfico lleva sus cifras escritas: el color nunca es el único canal.
 *   · `role="img"` + `aria-label` describen la serie para lectores de pantalla.
 *
 * Todo es CSS/SVG puro: no agrega dependencias ni peticiones de red, así que
 * no retrasa la carga de ninguna pantalla.
 */
import React from 'react';
import { CornerUpLeft } from 'lucide-react';
import { COLOR_ESTADO, TONO_ESTADO } from '../../constants/ofbol';

const TONOS = ['gris', 'oliva', 'ambar', 'crimson', 'teal'];

/** Convierte un hex a rgba con alfa dado. */
function alfa(hex, a) {
    const h = (hex || '#5a615f').replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function colorDe(nombre, indice = 0) {
    return COLOR_ESTADO[nombre] || ['#3d4a2c', '#9a6f0a', '#1a5c52', '#8b4513', '#495456'][indice % 5];
}

function tonoDe(nombre, explicito) {
    if (explicito && TONOS.includes(explicito)) return explicito;
    return TONO_ESTADO[nombre] || 'gris';
}

/* ══════════════════════════════════════════════════════════════
   Leyenda — acompaña a toda banda, dona o comparativa
   ══════════════════════════════════════════════════════════════ */

export function Leyenda({ datos = [], formatear = (n) => n }) {
    if (!datos.length) return null;
    return (
        <div className="ofbol-leyenda">
            {datos.map((d, i) => (
                <span key={d.label ?? i} className="ofbol-leyenda-item">
                    <span className="ofbol-leyenda-punto" style={{ background: d.color || colorDe(d.label, i) }} aria-hidden="true" />
                    <span className="ofbol-leyenda-nombre">{d.label}</span>
                    <span className="ofbol-leyenda-valor">{formatear(d.total)}</span>
                </span>
            ))}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════
   FlujoDocumental — el recorrido del trámite como diagrama
   Sustituye párrafos que explicaban "cómo circula un memorándum".
   ══════════════════════════════════════════════════════════════ */

export function FlujoDocumental({ etapas = [], onSeleccion, activa = null, retorno = null, ariaLabel }) {
    if (!etapas.length) return null;

    return (
        <div>
            <div
                className="ofbol-flujo"
                style={{ '--etapas': etapas.length }}
                role="img"
                aria-label={ariaLabel || `Recorrido en ${etapas.length} etapas: ${etapas.map((e) => `${e.label} ${e.conteo ?? 0}`).join(', ')}`}
            >
                {etapas.map((e) => {
                    const Icono = e.icono;
                    const estado = e.estado ?? 'pendiente';
                    const interactiva = typeof onSeleccion === 'function';
                    return (
                        <button
                            key={e.clave}
                            type="button"
                            className="ofbol-flujo-etapa"
                            data-activa={estado === 'activa' || activa === e.clave}
                            data-completa={estado === 'completa'}
                            onClick={interactiva ? () => onSeleccion(e.clave) : undefined}
                            disabled={!interactiva}
                            aria-pressed={interactiva ? activa === e.clave : undefined}
                        >
                            <span className="ofbol-flujo-nodo">
                                {Icono ? <Icono size={16} strokeWidth={1.9} aria-hidden="true" /> : <span className="ofbol-flujo-cifra">{e.conteo ?? 0}</span>}
                            </span>
                            <span className="ofbol-flujo-nombre">{e.label}</span>
                            {e.conteo !== undefined && <span className="ofbol-flujo-cifra">{e.conteo}</span>}
                            {e.sub && <span className="ofbol-flujo-nota">{e.sub}</span>}
                        </button>
                    );
                })}
            </div>

            {retorno && (
                <div className="ofbol-flujo-retorno">
                    <CornerUpLeft size={12} aria-hidden="true" />
                    <span>{retorno}</span>
                </div>
            )}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════
   LineaTiempo — trazabilidad vertical con riel y nodos
   Sustituye listas de párrafos con "El usuario X cambió el estado a Y".
   ══════════════════════════════════════════════════════════════ */

export function LineaTiempo({ eventos = [], numerar = true, ariaLabel = 'Línea de tiempo' }) {
    if (!eventos.length) return null;
    const total = eventos.length;

    return (
        <ol className="ofbol-tl" aria-label={ariaLabel}>
            {eventos.map((ev, i) => {
                const Icono = ev.icono;
                return (
                    <li key={ev.id ?? i} className="ofbol-tl-item" data-tono={tonoDe(ev.tonoEstado, ev.tono)}>
                        <span className="ofbol-tl-punto" aria-hidden="true">
                            {Icono ? <Icono size={14} strokeWidth={1.9} /> : numerar ? total - i : ''}
                        </span>
                        <div className="ofbol-tl-cuerpo">
                            <div className="ofbol-tl-cabecera">
                                <p className="ofbol-tl-titulo">{ev.titulo}</p>
                                {ev.fecha && <span className="ofbol-tl-fecha">{ev.fecha}</span>}
                            </div>
                            {ev.detalle && <p className="ofbol-tl-detalle">{ev.detalle}</p>}
                            {ev.meta?.length > 0 && (
                                <div className="ofbol-tl-meta">
                                    {ev.meta.map((m, j) => (
                                        <span key={j} className={`ofbol-badge ofbol-badge--${m.tono || 'olive'}`}>
                                            {m.texto}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}

/* ══════════════════════════════════════════════════════════════
   BandaEstados — composición de estados al 100%
   Mucho más legible que una lista de filas "Estado … 12 (34%)".
   ══════════════════════════════════════════════════════════════ */

export function BandaEstados({ datos = [], grande = false, mostrarLeyenda = true, ariaLabel }) {
    const serie = (datos || []).filter((d) => (d.total ?? 0) > 0);
    const total = serie.reduce((s, d) => s + (d.total ?? 0), 0);

    if (!total) {
        return <p className="ofbol-vacio-nota">Sin documentos registrados.</p>;
    }

    return (
        <div>
            <div
                className={`ofbol-banda${grande ? ' ofbol-banda-lg' : ''}`}
                role="img"
                aria-label={ariaLabel || serie.map((d) => `${d.label}: ${d.total}`).join('. ')}
            >
                {serie.map((d, i) => (
                    <span
                        key={d.label ?? i}
                        className="ofbol-banda-tramo"
                        style={{ width: `${((d.total ?? 0) / total) * 100}%`, background: d.color || colorDe(d.label, i) }}
                        title={`${d.label}: ${d.total} (${Math.round(((d.total ?? 0) / total) * 100)}%)`}
                    />
                ))}
            </div>
            {mostrarLeyenda && <div className="mt-3"><Leyenda datos={serie} /></div>}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════
   ComparativaEntidades — barras apiladas por EPI
   Una fila por unidad; el largo y la composición se leen de un golpe.
   ══════════════════════════════════════════════════════════════ */

export function ComparativaEntidades({ filas = [], columnas = [], onSeleccion, activaId, idKey = 'id', ariaLabel }) {
    if (!filas.length) {
        return <p className="ofbol-vacio-nota">Sin datos para comparar.</p>;
    }
    const tope = Math.max(...filas.map((f) => f.total ?? 0), 1);

    return (
        <div>
            {columnas.length > 0 && (
                <div className="mb-3">
                    <Leyenda datos={columnas} />
                </div>
            )}
            <div
                className="ofbol-comp"
                role="img"
                aria-label={ariaLabel || filas.map((f) => `${f.nombre}: ${f.total}`).join('. ')}
            >
                {filas.map((f, i) => {
                    const interactiva = typeof onSeleccion === 'function';
                    const Etiqueta = interactiva ? 'button' : 'div';
                    return (
                        <Etiqueta
                            key={f[idKey] ?? f.nombre ?? i}
                            {...(interactiva ? { type: 'button', onClick: () => onSeleccion(f) } : {})}
                            className="ofbol-comp-fila"
                            data-activa={activaId !== undefined && String(activaId) === String(f[idKey])}
                            aria-pressed={interactiva ? String(activaId) === String(f[idKey]) : undefined}
                        >
                            <span className="ofbol-comp-nombre" title={f.nombre}>{f.nombre}</span>
                            <span className="ofbol-comp-pista">
                                {(f.segmentos || []).map((s, j) => (
                                    (s.total ?? 0) > 0 && (
                                        <span
                                            key={s.label ?? j}
                                            className="ofbol-comp-lleno"
                                            style={{
                                                width: `${((s.total ?? 0) / tope) * 100}%`,
                                                background: s.color || colorDe(s.label, j),
                                            }}
                                            title={`${s.label}: ${s.total}`}
                                        />
                                    )
                                ))}
                            </span>
                            <span className="ofbol-comp-total">{f.total ?? 0}</span>
                        </Etiqueta>
                    );
                })}
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════
   MapaCalor — cruce entidad × estado
   Mucha más información en el mismo espacio que una tabla de texto.
   ══════════════════════════════════════════════════════════════ */

export function MapaCalor({ columnas = [], filas = [], onCelda, activaId, idKey = 'id' }) {
    if (!filas.length || !columnas.length) {
        return <p className="ofbol-vacio-nota">Sin datos de cruce.</p>;
    }
    const max = Math.max(...filas.flatMap((f) => f.valores.map((v) => v ?? 0)), 1);

    return (
        <div className="ofbol-heat ofbol-scroll" style={{ '--cols': columnas.length, overflowX: 'auto' }}>
            <span />
            {columnas.map((c) => (
                <span key={c.label} className="ofbol-heat-encabezado" title={c.label}>{c.label}</span>
            ))}

            {filas.map((f) => (
                <React.Fragment key={f[idKey] ?? f.nombre}>
                    <span className="ofbol-heat-fila" title={f.nombre}>{f.nombre}</span>
                    {f.valores.map((v, i) => {
                        const col = columnas[i];
                        const valor = v ?? 0;
                        if (valor === 0) {
                            return <span key={i} className="ofbol-heat-celda" data-vacia="true" aria-label={`${f.nombre}, ${col?.label}: sin documentos`}>–</span>;
                        }
                        const nivel = Math.ceil((valor / max) * 3);
                        const color = col?.color || colorDe(col?.label, i);
                        const solido = nivel >= 3;
                        const interactiva = typeof onCelda === 'function';
                        const compartida = { className: 'ofbol-heat-celda' };
                        const estilo = {
                            background: solido ? color : alfa(color, 0.1 + nivel * 0.14),
                            color: solido ? '#fbfaf6' : color,
                        };
                        const rotulo = `${f.nombre}, ${col?.label}: ${valor}`;
                        return interactiva ? (
                            <button
                                key={i}
                                type="button"
                                {...compartida}
                                style={estilo}
                                data-activa={activaId !== undefined && String(activaId) === String(f[idKey])}
                                onClick={() => onCelda(f, col, valor)}
                                aria-label={rotulo}
                                title={rotulo}
                            >
                                {valor}
                            </button>
                        ) : (
                            <span key={i} {...compartida} style={estilo} role="img" aria-label={rotulo} title={rotulo}>{valor}</span>
                        );
                    })}
                </React.Fragment>
            ))}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════
   ChipsDato — métricas comprimidas
   Convierte una frase ("hay 4 observados y 2 en revisión") en cifras.
   ══════════════════════════════════════════════════════════════ */

export function ChipsDato({ datos = [] }) {
    const visibles = datos.filter(Boolean);
    if (!visibles.length) return null;
    return (
        <div className="ofbol-datos">
            {visibles.map((d, i) => (
                <span key={d.etiqueta ?? i} className="ofbol-dato-chip">
                    <b style={d.color ? { color: d.color } : undefined}>{d.valor}</b>
                    <span>{d.etiqueta}</span>
                </span>
            ))}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════
   RangoTiempo — mínimo · promedio · máximo
   Para tiempos de tramitación, donde tres cifras dicen más que una.
   ══════════════════════════════════════════════════════════════ */

export function RangoTiempo({ min = 0, max = 0, promedio = 0, formatear = (v) => v, etiquetaMin = 'Mín', etiquetaMax = 'Máx', etiquetaProm = 'Promedio' }) {
    const tope = Math.max(max, 1);
    const izq = Math.min(min, promedio) / tope;
    const der = Math.max(promedio, min) / tope;
    const posProm = (promedio / tope) * 100;
    const posMin = (min / tope) * 100;

    return (
        <div
            role="img"
            aria-label={`${etiquetaMin} ${formatear(min)}, ${etiquetaProm} ${formatear(promedio)}, ${etiquetaMax} ${formatear(max)}`}
        >
            <div className="ofbol-rango">
                <span className="ofbol-rango-marca" style={{ left: `${posMin}%` }} data-label={formatear(min)} />
                <span
                    className="ofbol-rango-marca"
                    style={{ left: `${Math.min(99, Math.max(1, posProm))}%`, background: '#9a6f0a' }}
                    data-label={formatear(promedio)}
                />
                <span
                    className="ofbol-rango-fill"
                    style={{ left: `${izq * 100}%`, width: `${Math.max((der - izq) * 100, 4)}%` }}
                />
            </div>
            <div className="flex justify-between items-baseline mt-3">
                <span className="ofbol-flujo-nota">{etiquetaMin} {formatear(min)}</span>
                <span className="ofbol-flujo-nota" style={{ color: '#9a6f0a' }}>{etiquetaProm} {formatear(promedio)}</span>
                <span className="ofbol-flujo-nota">{etiquetaMax} {formatear(max)}</span>
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════
   EstadoVacio — sin contenido, pero compuesto
   Usa el sistema de iconos existente: nada de viñetas dibujadas a mano.
   ══════════════════════════════════════════════════════════════ */

export function EstadoVacio({ icono, titulo, nota, accion, compacto = false }) {
    const Icono = icono;
    return (
        <div className="ofbol-vacio" style={compacto ? { padding: '18px 16px' } : undefined}>
            {Icono && (
                <span
                    className="flex items-center justify-center rounded-xl"
                    style={{ width: 40, height: 40, background: '#f2f0ea', color: '#969b98' }}
                    aria-hidden="true"
                >
                    <Icono size={18} strokeWidth={1.8} />
                </span>
            )}
            {titulo && <p className="ofbol-vacio-titulo">{titulo}</p>}
            {nota && <p className="ofbol-vacio-nota">{nota}</p>}
            {accion}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════
   GraficoLineas — tendencia temporal
   Sustituye a una librería de gráficos (≈120 kB gzip menos que
   descargar). Los trazos usan `non-scaling-stroke`, así el grosor
   no se deforma; las cifras de los ejes van en HTML, siempre nítidas.
   ══════════════════════════════════════════════════════════════ */

export function GraficoLineas({ series = [], categorias = [], altura = 190, formatear = (v) => v, ariaLabel }) {
    const visibles = series.filter((s) => s.valores?.length && s.valores.some((v) => (v ?? 0) > 0));
    if (!visibles.length || !categorias.length) {
        return <p className="ofbol-vacio-nota">Sin serie para el período seleccionado.</p>;
    }

    const n = categorias.length;
    const max = Math.max(...visibles.flatMap((s) => s.valores.map((v) => v ?? 0)), 1);
    const paso = n > 1 ? 100 / (n - 1) : 0;
    const posX = (i) => (n > 1 ? i * paso : 50);
    const posY = (v) => 100 - (Math.max(0, v ?? 0) / max) * 100;
    const salto = Math.max(1, Math.ceil(n / 7));

    return (
        <div>
            <div className="ofbol-lc">
                <div className="ofbol-lc-eje-y">
                    {[1, 0.75, 0.5, 0.25, 0].map((t) => (
                        <span key={t}>{formatear(Math.round(max * t))}</span>
                    ))}
                </div>

                <div className="ofbol-lc-area">
                    <div className="ofbol-lc-plano">
                    {[0, 0.25, 0.5, 0.75, 1].map((g) => (
                        <span key={g} className="ofbol-lc-guia" style={{ bottom: `${g * 100}%` }} />
                    ))}

                    <svg
                        className="ofbol-lc-svg"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        height={altura}
                        role="img"
                        aria-label={
                            ariaLabel ||
                            `${categorias[0]} a ${categorias[n - 1]}. ` +
                                visibles.map((s) => `${s.label}: máximo ${Math.max(...s.valores)}`).join('. ')
                        }
                    >
                        {visibles.map((s, k) => {
                            const color = s.color || colorDe(s.label, k);
                            const puntos = s.valores.map((v, i) => `${posX(i)},${posY(v)}`).join(' ');
                            return (
                                <g key={s.label ?? k}>
                                    {s.tipo === 'area' && (
                                        <polygon
                                            points={`${posX(0)},100 ${puntos} ${posX(n - 1)},100`}
                                            fill={alfa(color, 0.14)}
                                        />
                                    )}
                                    <polyline
                                        points={puntos}
                                        fill="none"
                                        stroke={color}
                                        strokeWidth={2}
                                        strokeDasharray={s.tipo === 'linea' ? '5 3' : undefined}
                                        strokeLinejoin="round"
                                        strokeLinecap="round"
                                        vectorEffect="non-scaling-stroke"
                                    />
                                </g>
                            );
                        })}
                    </svg>
                    </div>

                    <div className="ofbol-lc-eje-x">
                        {categorias.map((c, i) =>
                            i % salto === 0 || i === n - 1 ? (
                                <span key={i} style={{ left: `${posX(i)}%` }}>{c}</span>
                            ) : null,
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-3">
                <Leyenda datos={visibles.map((s, k) => ({ label: s.label, color: s.color || colorDe(s.label, k) }))} />
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════
   GraficoColumnas — comparación entre categorías
   Agrupadas (series lado a lado) o apiladas (una columna compuesta).
   ══════════════════════════════════════════════════════════════ */

export function GraficoColumnas({
    datos = [],
    series = [],
    apilado = false,
    altura = 190,
    formatear = (v) => v,
    mostrarTotal = false,
    onColumna,
    ariaLabel,
}) {
    if (!datos.length || !series.length) {
        return <p className="ofbol-vacio-nota">Sin datos para graficar.</p>;
    }

    const totales = datos.map((d) => (d.valores ?? []).reduce((a, v) => a + (v ?? 0), 0));
    const max = Math.max(...(apilado ? totales : datos.flatMap((d) => d.valores ?? [])), 1);

    return (
        <div className="ofbol-col">
            <div
                className="ofbol-col-ploteo"
                style={{ height: altura }}
                role="img"
                aria-label={ariaLabel || datos.map((d, i) => `${d.label}: ${totales[i]}`).join('. ')}
            >
                {[0, 0.25, 0.5, 0.75, 1].map((g) => (
                    <span key={g} className="ofbol-col-guia" style={{ bottom: `${g * 100}%` }}>
                        <span>{formatear(Math.round(max * g))}</span>
                    </span>
                ))}

                {datos.map((d, i) => {
                    const valores = d.valores ?? [];
                    const interactiva = typeof onColumna === 'function';
                    return (
                        <div
                            key={d.label ?? i}
                            className="ofbol-col-grupo"
                            {...(interactiva
                                ? {
                                      role: 'button',
                                      tabIndex: 0,
                                      style: { cursor: 'pointer' },
                                      onClick: () => onColumna(d),
                                      onKeyDown: (ev) => {
                                          if (ev.key === 'Enter' || ev.key === ' ') {
                                              ev.preventDefault();
                                              onColumna(d);
                                          }
                                      },
                                  }
                                : {})}
                        >
                            {apilado ? (
                                <div className="ofbol-col-apilado">
                                    {series.map((s, j) => {
                                        const v = valores[j] ?? 0;
                                        if (v <= 0) return null;
                                        return (
                                            <span
                                                key={s.label ?? j}
                                                className="ofbol-col-barra"
                                                style={{ height: `${(v / max) * 100}%`, background: s.color || colorDe(s.label, j) }}
                                                title={`${s.label}: ${v}`}
                                            />
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="ofbol-col-barras">
                                    {series.map((s, j) => {
                                        const v = valores[j] ?? 0;
                                        return (
                                            <span
                                                key={s.label ?? j}
                                                className="ofbol-col-barra"
                                                style={{ height: `${(v / max) * 100}%`, background: s.color || colorDe(s.label, j) }}
                                                title={`${s.label}: ${v}`}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="ofbol-col-etiquetas">
                {datos.map((d, i) => (
                    <div key={d.label ?? i} className="ofbol-col-etiqueta">
                        {mostrarTotal && <span className="ofbol-col-total">{totales[i]}</span>}
                        <span className="ofbol-col-label" title={d.label}>{d.label}</span>
                    </div>
                ))}
            </div>

            <Leyenda datos={series.map((s, j) => ({ label: s.label, color: s.color || colorDe(s.label, j) }))} />
        </div>
    );
}

export { colorDe, alfa };
