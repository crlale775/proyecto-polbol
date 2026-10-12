/**
 * Historial — recorrido institucional completo del Comando Departamental.
 *
 * Lee:
 *   - DocumentoController       → GET /api/documentos
 *   - HistorialEstadoController → GET /api/historial-estados
 *   - EpiController             → GET /api/epis
 *
 * Cada trámite muestra su cadena de custodia como línea de tiempo: nodo por
 * nivel, con fecha y responsable. Nada de párrafos explicativos.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { FileText, Search, History, UploadCloud, Stamp, Landmark, ChevronDown } from 'lucide-react';
import LayoutComandoDepartamental from '../../js/components/LayoutComandoDepartamental';
import EstadoBadge from '../../js/components/ui/EstadoBadge';
import Spinner from '../../js/components/ui/Spinner';
import Alert from '../../js/components/ui/Alert';
import { LineaTiempo, EstadoVacio, ChipsDato } from '../../js/components/ui/Graficos';
import api from '../../js/lib/api';

const fechaHora = (f) => (f ? new Date(f).toLocaleString('es-BO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

/** Acepta la forma camelCase y la snake_case del endpoint de historial. */
const estadoDe = (h) => h.estadoNuevo?.nombre ?? h.estado_nuevo?.nombre ?? 'Actualización';
const usuarioDe = (h) => h.usuarioRelacion ?? h.usuario_cambio ?? null;
const fechaDe = (h) => h.fecha ?? h.fecha_cambio;

/** Los eventos del recorrido, listos para la línea de tiempo. */
function eventosRecorrido(doc, historialItems) {
    const eventos = [];

    eventos.push({
        id: `alta-${doc.id_documento}`,
        titulo: `Emitido en ${doc.epi?.nombre ?? 'la EPI'}`,
        fecha: fechaHora(doc.fecha_subida),
        detalle: doc.usuario?.usuario ? `Registrado por ${doc.usuario.usuario}.` : undefined,
        icono: UploadCloud,
        tono: 'oliva',
        meta: doc.tipo_documento?.nombre ? [{ texto: doc.tipo_documento.nombre, tono: 'olive' }] : [],
    });

    historialItems
        .toSorted((a, b) => new Date(fechaDe(a) ?? 0) - new Date(fechaDe(b) ?? 0))
        .forEach((h, idx) => {
            const u = usuarioDe(h);
            eventos.push({
                id: `hist-${h.id_historial ?? idx}`,
                titulo: estadoDe(h),
                fecha: fechaHora(fechaDe(h)),
                detalle: u?.usuario
                    ? `Dictamen de ${u.usuario}${u.epi?.nombre ? ` · ${u.epi.nombre}` : ' · Comando Departamental La Paz'}.`
                    : undefined,
                icono: Stamp,
                tonoEstado: estadoDe(h),
                meta: [],
            });
        });

    if (['Aprobado', 'Remitido al Comando General', 'Registrado'].includes(doc.estado?.nombre)) {
        eventos.push({
            id: `remision-${doc.id_documento}`,
            titulo: 'Remitido al Comando General',
            fecha: 'Visado',
            detalle: 'Trámite conforme a norma y elevado a la Dirección General de Personal.',
            icono: Landmark,
            tono: 'teal',
        });
    }

    return eventos;
}

function RecorridoCard({ doc, historialItems }) {
    const [abierto, setAbierto] = useState(false);
    const eventos = useMemo(() => eventosRecorrido(doc, historialItems), [doc, historialItems]);

    return (
        <article className="ofbol-card overflow-hidden">
            {/* ── Cabecera del trámite ── */}
            <div className="p-4 flex items-start gap-4">
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
                        <EstadoBadge nombre={doc.estado?.nombre ?? 'Borrador'} />
                        <span className="ofbol-badge ofbol-badge--olive">{doc.epi?.nombre ?? 'EPI La Paz'}</span>
                    </div>

                    <p className="text-[11.5px] text-[#5a615f] mt-1.5 truncate">
                        {doc.tipo_documento?.nombre ?? 'Trámite'}
                        <span className="text-[#cfc9bc]"> · </span>
                        {doc.oficial?.grado?.abreviatura && (
                            <span className="font-bold text-[#3d4a2c]">{doc.oficial.grado.abreviatura} </span>
                        )}
                        <span className="font-bold text-[#3f4849]">
                            {doc.oficial?.nombres} {doc.oficial?.apellidos}
                        </span>
                        {doc.oficial?.ci && <span className="text-[#cfc9bc]"> · CI {doc.oficial.ci}</span>}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => setAbierto((v) => !v)}
                    aria-expanded={abierto}
                    className="ofbol-btn-ghost shrink-0"
                >
                    {abierto ? 'Ocultar' : 'Ver recorrido'}
                    <ChevronDown
                        size={13}
                        strokeWidth={2.4}
                        aria-hidden="true"
                        style={{ transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform 180ms cubic-bezier(0.16,1,0.3,1)' }}
                    />
                </button>
            </div>

            {/* ── Cadena de custodia ── */}
            {abierto && (
                <div className="px-4 pb-4 pt-4" style={{ borderTop: '1px solid #e3dfd6' }}>
                    <div className="mb-4">
                        <ChipsDato
                            datos={[
                                { valor: historialItems.length + 1, etiqueta: 'Etapas registradas' },
                                { valor: doc.usuario?.usuario ?? '—', etiqueta: 'Secretario remitente' },
                            ]}
                        />
                    </div>
                    <LineaTiempo eventos={eventos} ariaLabel={`Recorrido de ${doc.codigo_documento}`} />
                </div>
            )}
        </article>
    );
}

export default function Historial() {
    const [documentos, setDocumentos] = useState([]);
    const [historial, setHistorial] = useState([]);
    const [epis, setEpis] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [busqueda, setBusqueda] = useState('');
    const [filtroEpi, setFiltroEpi] = useState('');

    useEffect(() => {
        async function cargar() {
            setLoading(true);
            try {
                const [docs, hist, listaEpis] = await Promise.all([
                    api.get('/documentos'),
                    api.get('/historial-estados'),
                    api.get('/epis'),
                ]);
                setDocumentos(Array.isArray(docs) ? docs : []);
                setHistorial(Array.isArray(hist) ? hist : []);
                setEpis(Array.isArray(listaEpis) ? listaEpis : []);
            } catch {
                setError('No se pudo cargar el historial general.');
            } finally {
                setLoading(false);
            }
        }
        cargar();
    }, []);

    /* Índice por documento: evita recorrer el historial completo en cada fila. */
    const historialPorDoc = useMemo(() => {
        const map = new Map();
        historial.forEach((h) => {
            if (!map.has(h.id_documento)) map.set(h.id_documento, []);
            map.get(h.id_documento).push(h);
        });
        return map;
    }, [historial]);

    const docsFiltrados = useMemo(() => {
        let list = [...documentos];
        if (filtroEpi) {
            list = list.filter((d) => d.id_epi === parseInt(filtroEpi));
        }
        if (busqueda.trim()) {
            const q = busqueda.toLowerCase();
            list = list.filter(
                (d) =>
                    d.codigo_documento?.toLowerCase().includes(q) ||
                    d.oficial?.nombres?.toLowerCase().includes(q) ||
                    d.oficial?.apellidos?.toLowerCase().includes(q) ||
                    d.oficial?.ci?.includes(q) ||
                    d.epi?.nombre?.toLowerCase().includes(q)
            );
        }
        return list.toSorted((a, b) => new Date(b.fecha_subida) - new Date(a.fecha_subida));
    }, [documentos, filtroEpi, busqueda]);

    const hayFiltro = Boolean(busqueda || filtroEpi);

    return (
        <LayoutComandoDepartamental>
            <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 ofbol-page-enter">
                {/* ── Encabezado ── */}
                <header>
                    <h1 className="ofbol-display heading-balance">Historial y trazabilidad</h1>
                    <p className="ofbol-nota mt-2">
                        Cadena de custodia de los trámites de las 9 EPIs de La Paz: quién los emitió,
                        quién los visó y en qué momento.
                    </p>
                    {!loading && (
                        <div className="mt-4">
                            <ChipsDato
                                datos={[
                                    { valor: documentos.length, etiqueta: 'Trámites' },
                                    { valor: historial.length, etiqueta: 'Eventos registrados' },
                                    { valor: epis.length, etiqueta: 'EPIs' },
                                ]}
                            />
                        </div>
                    )}
                </header>

                {error && <Alert type="warning" onClose={() => setError(null)}>{error}</Alert>}

                {/* ── Filtros ── */}
                <div className="ofbol-card p-4 flex flex-wrap gap-3 items-center">
                    <div className="relative flex-1 min-w-[14rem]">
                        <Search
                            size={15}
                            strokeWidth={2}
                            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                            style={{ color: '#969b98' }}
                            aria-hidden="true"
                        />
                        <label htmlFor="hist-dep-busqueda" className="sr-only">Buscar por código, oficial, CI o EPI</label>
                        <input
                            id="hist-dep-busqueda"
                            name="busqueda"
                            type="search"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Código, oficial, CI o EPI…"
                            className="ofbol-input w-full pl-9"
                        />
                    </div>

                    <div>
                        <label htmlFor="hist-dep-epi" className="sr-only">Filtrar por EPI</label>
                        <select
                            id="hist-dep-epi"
                            name="epi"
                            value={filtroEpi}
                            onChange={(e) => setFiltroEpi(e.target.value)}
                            className="ofbol-input"
                        >
                            <option value="">Todas las EPIs</option>
                            {epis.map((e) => (
                                <option key={e.id_epi} value={e.id_epi}>{e.nombre}</option>
                            ))}
                        </select>
                    </div>

                    {hayFiltro && (
                        <button
                            type="button"
                            onClick={() => { setBusqueda(''); setFiltroEpi(''); }}
                            className="ofbol-btn-ghost"
                        >
                            Quitar filtros
                        </button>
                    )}
                </div>

                {/* ── Listado ── */}
                {loading ? (
                    <div className="flex justify-center py-20"><Spinner /></div>
                ) : docsFiltrados.length === 0 ? (
                    <div className="ofbol-card">
                        <EstadoVacio
                            icono={History}
                            titulo="Sin trámites para mostrar"
                            nota={
                                hayFiltro
                                    ? 'Ningún trámite coincide con la búsqueda o la EPI seleccionada.'
                                    : 'Los trámites de las 9 EPIs van a aparecer acá con su recorrido completo.'
                            }
                        />
                    </div>
                ) : (
                    <div className="space-y-3">
                        {docsFiltrados.map((doc) => (
                            <RecorridoCard
                                key={doc.id_documento}
                                doc={doc}
                                historialItems={historialPorDoc.get(doc.id_documento) ?? []}
                            />
                        ))}
                    </div>
                )}
            </div>
        </LayoutComandoDepartamental>
    );
}
