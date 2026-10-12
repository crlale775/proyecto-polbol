/**
 * Historial — recorrido de estados de los trámites del Secretario EPI.
 *
 * Conecta con:
 *   - HistorialEstadoController → GET /api/historial-estados
 *   - DocumentoController       → GET /api/documentos?id_epi=X
 *
 * Cada documento se lee de un golpe: código, estado actual y tipo en la
 * cabecera. Al abrirlo, el recorrido es una línea de tiempo con nodos, no
 * una lista de frases.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { FileText, History, Search, X, ChevronDown } from 'lucide-react';
import LayoutSecretario from '../../js/components/LayoutSecretario';
import EstadoBadge from '../../js/components/ui/EstadoBadge';
import Spinner from '../../js/components/ui/Spinner';
import Alert from '../../js/components/ui/Alert';
import { LineaTiempo, EstadoVacio, ChipsDato } from '../../js/components/ui/Graficos';
import { useAuth } from '../../js/context/AuthContext';
import api from '../../js/lib/api';

function formatearFecha(f, conHora = false) {
    if (!f) return '—';
    return new Date(f).toLocaleDateString('es-BO', {
        day: '2-digit', month: 'short', year: 'numeric',
        ...(conHora ? { hour: '2-digit', minute: '2-digit' } : {}),
    });
}

/** Los cambios de estado, como eventos de una línea de tiempo. */
function eventosDe(entries) {
    return entries.map((entry, i) => {
        const nuevo = entry.estado_nuevo?.nombre;
        const anterior = entry.estado_anterior?.nombre;
        const meta = [];
        if (anterior) meta.push({ texto: `Desde ${anterior}`, tono: 'olive' });
        if (entry.usuario_cambio?.usuario) meta.push({ texto: entry.usuario_cambio.usuario, tono: 'teal' });

        return {
            id: `${entry.id_historial ?? 'nuevo'}-${entry.fecha_cambio ?? i}-${i}`,
            titulo: nuevo ?? 'Actualización de estado',
            fecha: formatearFecha(entry.fecha_cambio, true),
            detalle: entry.observacion ? `“${entry.observacion}”` : undefined,
            tonoEstado: nuevo,
            meta,
        };
    });
}

function DocCard({ doc, entries, expandido, onToggle }) {
    const estado = doc.estado?.nombre ?? 'Borrador';

    return (
        <article className="ofbol-card overflow-hidden">
            <div className="p-4 flex items-center gap-3">
                <span
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: '#f2f0ea', color: '#5a615f' }}
                    aria-hidden="true"
                >
                    <FileText size={18} strokeWidth={1.8} />
                </span>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-mono font-bold text-[#14181a] tracking-tight">
                            {doc.codigo_documento}
                        </p>
                        <EstadoBadge nombre={estado} />
                    </div>
                    <p className="text-[11px] text-[#5a615f] mt-1 truncate">
                        {doc.tipo_documento?.nombre ?? '—'}
                        <span className="text-[#cfc9bc]"> · </span>
                        {formatearFecha(doc.fecha_subida)}
                        <span className="text-[#cfc9bc]"> · </span>
                        <span className="tabular-nums">{entries.length}</span> {entries.length === 1 ? 'cambio' : 'cambios'}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={onToggle}
                    aria-expanded={expandido}
                    className="ofbol-btn-ghost shrink-0"
                >
                    {expandido ? 'Ocultar' : 'Ver recorrido'}
                    <ChevronDown
                        size={13}
                        strokeWidth={2.4}
                        style={{ transform: expandido ? 'rotate(180deg)' : 'none', transition: 'transform 180ms cubic-bezier(0.16,1,0.3,1)' }}
                    />
                </button>
            </div>

            {expandido && (
                <div className="px-4 pb-4 pt-3" style={{ borderTop: '1px solid #e3dfd6' }}>
                    {entries.length === 0 ? (
                        <p className="ofbol-vacio-nota">Este documento todavía no registra cambios de estado.</p>
                    ) : (
                        <LineaTiempo eventos={eventosDe(entries)} ariaLabel={`Recorrido de ${doc.codigo_documento}`} />
                    )}
                </div>
            )}
        </article>
    );
}

export default function Historial() {
    const { user } = useAuth();
    const [historial, setHistorial] = useState([]);
    const [documentos, setDocumentos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [busqueda, setBusqueda] = useState('');
    const [filtroDocumento, setFiltroDocumento] = useState('');
    const [expandidos, setExpandidos] = useState({});

    useEffect(() => {
        async function cargar() {
            setLoading(true);
            try {
                const params = user?.id_epi ? `?id_epi=${user.id_epi}` : '';
                const [hist, docs] = await Promise.all([
                    api.get('/historial-estados'),
                    api.get(`/documentos${params}`),
                ]);
                const lista = Array.isArray(docs) ? docs : [];
                setDocumentos(lista);

                // El endpoint devuelve el historial completo: se recorta a los
                // documentos de esta EPI, que ya vinieron filtrados.
                const idsDocs = new Set(lista.map((d) => d.id_documento));
                setHistorial((Array.isArray(hist) ? hist : []).filter((h) => idsDocs.has(h.id_documento)));
            } catch {
                setError('No se pudo cargar el historial.');
            } finally {
                setLoading(false);
            }
        }
        cargar();
    }, [user]);

    // Agrupar cambios por documento (el estado actual se toma del documento)
    const porDocumento = useMemo(() => {
        const map = new Map();
        historial.forEach((h) => {
            if (!map.has(h.id_documento)) map.set(h.id_documento, []);
            map.get(h.id_documento).push(h);
        });

        return documentos
            .map((doc) => ({
                doc,
                entries: (map.get(doc.id_documento) ?? []).toSorted(
                    (a, b) => new Date(b.fecha_cambio) - new Date(a.fecha_cambio)
                ),
            }))
            .filter((g) => g.entries.length > 0 || !filtroDocumento);
    }, [documentos, historial, filtroDocumento]);

    const filtrado = useMemo(() => {
        let list = porDocumento;

        if (filtroDocumento) {
            list = list.filter((g) => g.doc.id_documento == filtroDocumento);
        }

        if (busqueda.trim()) {
            const q = busqueda.toLowerCase();
            list = list.filter((g) =>
                g.doc.codigo_documento?.toLowerCase().includes(q) ||
                g.doc.tipo_documento?.nombre?.toLowerCase().includes(q) ||
                g.doc.referencia?.toLowerCase().includes(q) ||
                g.entries.some((h) => h.observacion?.toLowerCase().includes(q))
            );
        }

        return list.toSorted((a, b) => new Date(b.doc.fecha_subida) - new Date(a.doc.fecha_subida));
    }, [porDocumento, filtroDocumento, busqueda]);

    const hayFiltro = Boolean(busqueda || filtroDocumento);
    const totalCambios = useMemo(() => filtrado.reduce((a, g) => a + g.entries.length, 0), [filtrado]);
    const ultimoCambio = useMemo(() => {
        const todas = filtrado.flatMap((g) => g.entries).map((e) => e.fecha_cambio).filter(Boolean);
        return todas.length ? todas.toSorted((a, b) => new Date(b) - new Date(a))[0] : null;
    }, [filtrado]);

    const toggle = (id) => setExpandidos((prev) => ({ ...prev, [id]: !prev[id] }));

    return (
        <LayoutSecretario>
            <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 ofbol-page-enter">
                {/* ── Encabezado ── */}
                <header>
                    <h1 className="ofbol-display">Historial de cambios</h1>
                    <p className="ofbol-nota mt-2">
                        Recorrido de estados de los trámites de {user?.epi ?? 'tu EPI'}, del registro inicial al cierre.
                    </p>
                    {!loading && (
                        <div className="mt-4">
                            <ChipsDato
                                datos={[
                                    { valor: filtrado.length, etiqueta: 'Documentos' },
                                    { valor: totalCambios, etiqueta: 'Cambios de estado' },
                                    ultimoCambio
                                        ? { valor: formatearFecha(ultimoCambio), etiqueta: 'Último movimiento' }
                                        : null,
                                ]}
                            />
                        </div>
                    )}
                </header>

                {error && <Alert type="warning" onClose={() => setError(null)}>{error}</Alert>}

                {/* ── Filtros ── */}
                <div className="ofbol-card p-4 flex flex-wrap gap-3 items-center">
                    <div className="relative flex-1 min-w-[12rem]">
                        <Search
                            size={15}
                            strokeWidth={2}
                            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                            style={{ color: '#969b98' }}
                            aria-hidden="true"
                        />
                        <input
                            type="search"
                            id="historial-busqueda"
                            name="busqueda"
                            aria-label="Buscar en el historial por código, tipo, referencia u observación"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Código, tipo, referencia u observación…"
                            className="ofbol-input w-full pl-9"
                        />
                    </div>

                    <div>
                        <label htmlFor="historial-documento" className="sr-only">Filtrar por documento</label>
                        <select
                            id="historial-documento"
                            name="documento"
                            value={filtroDocumento}
                            onChange={(e) => setFiltroDocumento(e.target.value)}
                            className="ofbol-input"
                        >
                            <option value="">Todos los documentos</option>
                            {documentos.map((d) => (
                                <option key={d.id_documento} value={d.id_documento}>{d.codigo_documento}</option>
                            ))}
                        </select>
                    </div>

                    {hayFiltro && (
                        <button
                            type="button"
                            onClick={() => { setBusqueda(''); setFiltroDocumento(''); }}
                            className="ofbol-btn-ghost"
                        >
                            <X size={13} strokeWidth={2.4} aria-hidden="true" />
                            Limpiar
                        </button>
                    )}
                </div>

                {/* ── Listado ── */}
                {loading ? (
                    <div className="flex justify-center py-16"><Spinner /></div>
                ) : filtrado.length === 0 ? (
                    <div className="ofbol-card">
                        <EstadoVacio
                            icono={History}
                            titulo="Sin registros en el historial"
                            nota={
                                hayFiltro
                                    ? 'Ningún documento coincide con el filtro aplicado. Probá con otro código o quitá el filtro.'
                                    : 'Cuando tus trámites cambien de estado, acá vas a ver el recorrido completo con fechas y responsables.'
                            }
                        />
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtrado.map(({ doc, entries }) => (
                            <DocCard
                                key={doc.id_documento}
                                doc={doc}
                                entries={entries}
                                expandido={!!expandidos[doc.id_documento]}
                                onToggle={() => toggle(doc.id_documento)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </LayoutSecretario>
    );
}
