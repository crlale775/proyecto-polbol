/**
 * Historial.jsx — Historial general de trámites del Comando General.
 *
 * Lee:
 *   - DocumentoController → GET /api/documentos
 *   - EpiController       → GET /api/epis
 *
 * La pantalla abre con el recorrido institucional (cuántos trámites hay en
 * cada nivel de mando) y sigue con el listado. El volumen se lee como
 * diagrama; el detalle queda en cada fila, sin párrafos.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { FileText, RefreshCw, Download, Search, History, Landmark, Building2, ClipboardList } from 'lucide-react';
import LayoutComandoGeneral from '../../js/components/LayoutComandoGeneral';
import EstadoBadge from '../../js/components/ui/EstadoBadge';
import Spinner from '../../js/components/ui/Spinner';
import Alert from '../../js/components/ui/Alert';
import { FlujoDocumental, EstadoVacio, ChipsDato } from '../../js/components/ui/Graficos';
import api from '../../js/lib/api';

const ESTADOS_FINALES = ['Aprobado', 'Remitido al Comando General', 'Registrado'];

export default function Historial() {
    const [documentos, setDocumentos] = useState([]);
    const [epis, setEpis] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [busqueda, setBusqueda] = useState('');
    const [filtroEpi, setFiltroEpi] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('todos');

    const cargarDatos = async () => {
        setLoading(true);
        try {
            const [docs, listaEpis] = await Promise.all([
                api.get('/documentos'),
                api.get('/epis'),
            ]);
            setDocumentos(Array.isArray(docs) ? docs : []);
            setEpis(Array.isArray(listaEpis) ? listaEpis : []);
        } catch {
            setError('Error al sincronizar con el servidor.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarDatos();
    }, []);

    const filtrados = useMemo(() => {
        return documentos.filter((d) => {
            const q = busqueda.toLowerCase();
            const codigo = d.codigo_documento?.toLowerCase() || '';
            const oficial = `${d.oficial?.nombres || ''} ${d.oficial?.apellidos || ''}`.toLowerCase();
            const ref = d.referencia?.toLowerCase() || '';

            const coincideBusqueda = codigo.includes(q) || oficial.includes(q) || ref.includes(q);
            const coincideEpi = !filtroEpi || d.id_epi === parseInt(filtroEpi);

            const st = (d.estado?.nombre || '').toLowerCase();
            const coincideEstado =
                filtroEstado === 'todos' ||
                (filtroEstado === 'registrado' && st.includes('registrado')) ||
                (filtroEstado === 'pendiente' && !st.includes('registrado') && !st.includes('observ')) ||
                (filtroEstado === 'observado' && st.includes('observ'));

            return coincideBusqueda && coincideEpi && coincideEstado;
        }).toSorted((a, b) => new Date(b.fecha_subida) - new Date(a.fecha_subida));
    }, [documentos, busqueda, filtroEpi, filtroEstado]);

    /* Volumen real por nivel de mando: el diagrama lo dice sin una frase. */
    const etapas = useMemo(() => {
        const remitidos = documentos.filter((d) => ESTADOS_FINALES.includes(d.estado?.nombre)).length;
        const registrados = documentos.filter((d) => d.estado?.nombre === 'Registrado').length;
        return [
            {
                clave: 'epi',
                label: 'Secretaría EPI',
                sub: 'Emisión',
                conteo: documentos.length,
                icono: Building2,
                estado: documentos.length ? 'completa' : 'pendiente',
            },
            {
                clave: 'departamental',
                label: 'Cmd. Departamental',
                sub: 'Visado',
                conteo: remitidos,
                icono: ClipboardList,
                estado: remitidos ? 'completa' : 'pendiente',
            },
            {
                clave: 'general',
                label: 'Cmd. General',
                sub: 'Registro',
                conteo: registrados,
                icono: Landmark,
                estado: registrados ? 'activa' : 'pendiente',
            },
        ];
    }, [documentos]);

    const hayFiltro = Boolean(busqueda || filtroEpi || filtroEstado !== 'todos');

    return (
        <LayoutComandoGeneral>
            <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 ofbol-page-enter">

                {/* ── Encabezado ── */}
                <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="ofbol-display heading-balance">Historial general de trámites</h1>
                        <p className="ofbol-nota mt-2">
                            Todos los memorándums que atravesaron los tres niveles de mando, con su origen,
                            oficial destinatario y fecha de emisión.
                        </p>
                    </div>

                    <button type="button" onClick={cargarDatos} className="ofbol-btn-ghost self-start sm:self-auto">
                        <RefreshCw size={13} strokeWidth={2.4} aria-hidden="true" />
                        Actualizar
                    </button>
                </header>

                {error && <Alert type="error" onClose={() => setError(null)}>{error}</Alert>}

                {/* ── Recorrido institucional ── */}
                {!loading && documentos.length > 0 && (
                    <div className="ofbol-card p-5 sm:p-6">
                        <h2 className="ofbol-titulo-seccion mb-5">Recorrido institucional</h2>
                        <FlujoDocumental
                            etapas={etapas}
                            ariaLabel={`Recorrido institucional: ${etapas.map((e) => `${e.label} ${e.conteo}`).join(', ')}`}
                        />
                    </div>
                )}

                {/* ── Filtros ── */}
                <div className="ofbol-card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="relative">
                        <Search
                            size={15}
                            strokeWidth={2}
                            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                            style={{ color: '#969b98' }}
                            aria-hidden="true"
                        />
                        <label htmlFor="hist-general-busqueda" className="sr-only">Buscar por memo, oficial o referencia</label>
                        <input
                            id="hist-general-busqueda"
                            name="busqueda"
                            type="search"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar por memo, oficial o referencia…"
                            className="ofbol-input w-full pl-9"
                        />
                    </div>

                    <div>
                        <label htmlFor="hist-general-epi" className="sr-only">Filtrar por EPI de origen</label>
                        <select
                            id="hist-general-epi"
                            name="epi"
                            value={filtroEpi}
                            onChange={(e) => setFiltroEpi(e.target.value)}
                            className="ofbol-input w-full"
                        >
                            <option value="">Todas las EPIs de origen</option>
                            {epis.map((e) => (
                                <option key={e.id_epi} value={e.id_epi}>{e.nombre}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="hist-general-estado" className="sr-only">Filtrar por estado</label>
                        <select
                            id="hist-general-estado"
                            name="estado"
                            value={filtroEstado}
                            onChange={(e) => setFiltroEstado(e.target.value)}
                            className="ofbol-input w-full"
                        >
                            <option value="todos">Todos los estados</option>
                            <option value="registrado">Registrados (cerrados)</option>
                            <option value="pendiente">En curso</option>
                            <option value="observado">Observados</option>
                        </select>
                    </div>

                    {hayFiltro && (
                        <div className="sm:col-span-3 flex justify-end">
                            <button
                                type="button"
                                onClick={() => { setBusqueda(''); setFiltroEpi(''); setFiltroEstado('todos'); }}
                                className="ofbol-btn-ghost"
                            >
                                Quitar filtros
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Listado ── */}
                {loading ? (
                    <div className="flex justify-center py-20"><Spinner /></div>
                ) : filtrados.length === 0 ? (
                    <div className="ofbol-card">
                        <EstadoVacio
                            icono={History}
                            titulo="Sin registros históricos con estos criterios"
                            nota={
                                hayFiltro
                                    ? 'Ajustá los filtros de EPI, estado o búsqueda para ampliar el resultado.'
                                    : 'Cuando los memorándums se registren en el Comando General, van a aparecer acá.'
                            }
                        />
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <ChipsDato
                                datos={[
                                    { valor: filtrados.length, etiqueta: hayFiltro ? 'Coincidencias' : 'Trámites' },
                                    {
                                        valor: filtrados.filter((d) => ESTADOS_FINALES.includes(d.estado?.nombre)).length,
                                        etiqueta: 'Con vía completa',
                                    },
                                ]}
                            />
                        </div>

                        <ol className="space-y-3">
                            {filtrados.map((doc) => {
                                const fecha = doc.fecha_subida
                                    ? new Date(doc.fecha_subida).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
                                    : '—';

                                return (
                                    <li key={doc.id_documento} className="ofbol-card p-4">
                                        <div className="flex items-start gap-4">
                                            <span
                                                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                                style={{ background: '#f2f0ea', color: '#5a615f' }}
                                                aria-hidden="true"
                                            >
                                                <FileText size={18} strokeWidth={1.8} />
                                            </span>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-mono text-[12.5px] font-black tracking-tight text-[#14181a]">
                                                        {doc.codigo_documento}
                                                    </span>
                                                    <EstadoBadge nombre={doc.estado?.nombre || 'En trámite'} />
                                                    {doc.epi?.nombre && (
                                                        <span className="ofbol-badge ofbol-badge--olive">{doc.epi.nombre}</span>
                                                    )}
                                                </div>

                                                {doc.referencia && (
                                                    <p className="text-[12px] font-bold text-[#3f4849] mt-1.5 line-clamp-1" title={doc.referencia}>
                                                        {doc.referencia}
                                                    </p>
                                                )}

                                                <p className="text-[11px] text-[#5a615f] mt-1 truncate">
                                                    {doc.oficial?.grado?.abreviatura && (
                                                        <span className="font-bold text-[#3d4a2c]">{doc.oficial.grado.abreviatura} </span>
                                                    )}
                                                    {doc.oficial?.nombres} {doc.oficial?.apellidos}
                                                    {doc.oficial?.ci && <span className="text-[#cfc9bc]"> · CI {doc.oficial.ci}</span>}
                                                </p>
                                            </div>

                                            <div className="shrink-0 flex flex-col items-end gap-2">
                                                <span className="text-[11px] font-bold tabular-nums text-[#5a615f]">{fecha}</span>
                                                {doc.ruta_pdf && (
                                                    <a
                                                        href={`/storage/${doc.ruta_pdf}`}
                                                        download
                                                        className="ofbol-btn-ghost"
                                                        aria-label={`Descargar el PDF de ${doc.codigo_documento}`}
                                                    >
                                                        PDF
                                                        <Download size={12} strokeWidth={2.4} aria-hidden="true" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    </>
                )}
            </div>
        </LayoutComandoGeneral>
    );
}
