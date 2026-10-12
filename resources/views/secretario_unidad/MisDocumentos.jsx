/**
 * MisDocumentos — listado, filtros, búsqueda y gestión de documentos del Secretario EPI
 * Conecta con:
 *   - DocumentoController → GET /api/documentos?id_epi=X
 *   - TipoDocumentoController → GET /api/tipos-documento
 *   - EstadoDocumentoController → GET /api/estados-documento
 *   - RevisionController → GET /api/revisiones?id_documento=X
 *
 * Superficie: borde para la estructura, sombra solo para lo que flota. La tabla
 * usa `.ofbol-table`, los campos `.ofbol-input`, el detalle fichas (`ChipsDato`)
 * y los estados vacíos la primitiva compartida (`EstadoVacio`).
 */
import React, { useEffect, useState, useMemo } from 'react';
import { Eye, Download, FileText, Search } from 'lucide-react';
import LayoutSecretario from '../../js/components/LayoutSecretario';
import EstadoBadge from '../../js/components/ui/EstadoBadge';
import Spinner from '../../js/components/ui/Spinner';
import Alert from '../../js/components/ui/Alert';
import Modal from '../../js/components/ui/Modal';
import { ChipsDato, EstadoVacio } from '../../js/components/ui/Graficos';
import { useAuth } from '../../js/context/AuthContext';
import api from '../../js/lib/api';

const fechaLarga = (f) =>
    f
        ? new Date(f).toLocaleDateString('es-BO', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
          })
        : '—';

const fechaCorta = (f) =>
    f ? new Date(f).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ——————————————————————————————
// Detalle del documento
// ——————————————————————————————
function DetalleDocumento({ doc }) {
    const [revisiones, setRevisiones] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!doc) return;
        setLoading(true);
        api.get(`/revisiones?id_documento=${doc.id_documento}`)
            .then((data) => setRevisiones(Array.isArray(data) ? data : []))
            .catch(() => setRevisiones([]))
            .finally(() => setLoading(false));
    }, [doc]);

    if (!doc) return null;

    return (
        <div className="space-y-5">
            {/* Ficha del trámite: los datos se leen de un vistazo, no en prosa. */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-mono font-black text-[15px]" style={{ color: 'var(--ofbol-ink)' }}>
                        {doc.codigo_documento}
                    </p>
                    <p className="ofbol-etiqueta mt-0.5">{doc.tipo_documento?.nombre ?? '—'}</p>
                </div>
                <EstadoBadge nombre={doc.estado?.nombre ?? 'Borrador'} />
            </div>

            <ChipsDato
                datos={[
                    {
                        etiqueta: 'Oficial',
                        valor:
                            `${doc.oficial?.nombres ?? ''} ${doc.oficial?.apellidos ?? ''}`.trim() || '—',
                    },
                    { etiqueta: 'C.I.', valor: doc.oficial?.ci ?? '—' },
                    { etiqueta: 'Fecha', valor: fechaCorta(doc.fecha_subida) },
                    { etiqueta: 'Referencia', valor: doc.referencia ?? '—' },
                    { etiqueta: 'Hash SHA-256', valor: doc.hash ? `${doc.hash.slice(0, 20)}…` : '—' },
                    { etiqueta: 'Archivo', valor: doc.ruta_pdf ?? '—' },
                ]}
            />

            <div>
                <p className="ofbol-etiqueta mb-2">Revisiones del Comando Departamental</p>
                {loading ? (
                    <div className="flex justify-center py-4"><Spinner size="sm" /></div>
                ) : revisiones.length === 0 ? (
                    <EstadoVacio
                        compacto
                        icono={FileText}
                        titulo="Sin revisiones registradas"
                        nota="El Comando Departamental todavía no dictaminó este trámite."
                    />
                ) : (
                    <ul className="space-y-2">
                        {revisiones.map((r) => (
                            <li
                                key={r.id_revision}
                                className="rounded-[14px] p-3"
                                style={{
                                    background: 'var(--ofbol-amber-wash)',
                                    border: '1px solid rgba(154, 111, 10, 0.22)',
                                }}
                            >
                                <div className="flex items-baseline justify-between gap-2">
                                    <p className="text-xs font-black" style={{ color: '#7f5a07' }}>
                                        {r.estado}
                                    </p>
                                    <p className="ofbol-etiqueta">{r.nivel_revision}</p>
                                </div>
                                {r.observacion_libre && (
                                    <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--ofbol-ink-soft)' }}>
                                        «{r.observacion_libre}»
                                    </p>
                                )}
                                <p className="ofbol-etiqueta mt-1.5">{fechaCorta(r.fecha)}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

// ——————————————————————————————
// COMPONENTE PRINCIPAL
// ——————————————————————————————
export default function MisDocumentos() {
    const { user } = useAuth();
    const [documentos, setDocumentos] = useState([]);
    const [tipos, setTipos] = useState([]);
    const [estados, setEstados] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filtros
    const [busqueda, setBusqueda] = useState('');
    const [filtroTipo, setFiltroTipo] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('');
    const [orden, setOrden] = useState('fecha_desc');

    // Modal
    const [docSeleccionado, setDocSeleccionado] = useState(null);

    // Paginación
    const [pagina, setPagina] = useState(1);
    const POR_PAGINA = 10;

    useEffect(() => {
        async function cargar() {
            setLoading(true);
            try {
                const params = user?.id_epi ? `?id_epi=${user.id_epi}` : '';
                const [docs, t, e] = await Promise.all([
                    api.get(`/documentos${params}`),
                    api.get('/tipos-documento'),
                    api.get('/estados-documento'),
                ]);
                setDocumentos(Array.isArray(docs) ? docs : []);
                setTipos(Array.isArray(t) ? t : []);
                setEstados(Array.isArray(e) ? e : []);
            } catch (err) {
                setError('No se pudieron cargar los documentos.');
            } finally {
                setLoading(false);
            }
        }
        cargar();
    }, [user]);

    const filtrados = useMemo(() => {
        let list = [...documentos];

        if (busqueda.trim()) {
            const q = busqueda.toLowerCase();
            list = list.filter(
                (d) =>
                    d.codigo_documento?.toLowerCase().includes(q) ||
                    d.referencia?.toLowerCase().includes(q) ||
                    d.oficial?.nombres?.toLowerCase().includes(q) ||
                    d.oficial?.apellidos?.toLowerCase().includes(q) ||
                    d.oficial?.ci?.includes(q)
            );
        }

        if (filtroTipo) list = list.filter((d) => d.id_tipo == filtroTipo);
        if (filtroEstado) list = list.filter((d) => d.estado?.nombre === filtroEstado);

        // `toSorted` devuelve un arreglo NUEVO: sin reasignarlo, el selector de
        // orden existía pero no ordenaba nada.
        return list.toSorted((a, b) => {
            switch (orden) {
                case 'fecha_desc': return new Date(b.fecha_subida) - new Date(a.fecha_subida);
                case 'fecha_asc':  return new Date(a.fecha_subida) - new Date(b.fecha_subida);
                case 'codigo':     return (a.codigo_documento ?? '').localeCompare(b.codigo_documento ?? '');
                default:           return 0;
            }
        });
    }, [documentos, busqueda, filtroTipo, filtroEstado, orden]);

    const totalPaginas = Math.ceil(filtrados.length / POR_PAGINA);
    const docsPagina = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

    const limpiarFiltros = () => {
        setBusqueda('');
        setFiltroTipo('');
        setFiltroEstado('');
        setOrden('fecha_desc');
        setPagina(1);
    };

    const hayFiltros = !!(busqueda || filtroTipo || filtroEstado);

    return (
        <LayoutSecretario>
            <div className="p-6 lg:p-8 max-w-7xl mx-auto ofbol-page-enter">
                <div className="mb-6">
                    <h1 className="ofbol-display heading-balance">Mis documentos</h1>
                    <p className="ofbol-nota mt-2">
                        {loading
                            ? 'Cargando…'
                            : `${filtrados.length} documento${filtrados.length === 1 ? '' : 's'} registrado${filtrados.length === 1 ? '' : 's'} por esta unidad.`}
                    </p>
                </div>

                {error && <Alert type="warning" onClose={() => setError(null)}>{error}</Alert>}

                {/* Barra de filtros */}
                <div className="ofbol-card p-4 mb-4">
                    <div className="flex flex-wrap gap-3 items-center">
                        <div className="relative flex-1 min-w-48">
                            <Search
                                size={15}
                                className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                                style={{ color: 'var(--ofbol-muted)' }}
                                aria-hidden="true"
                            />
                            <input
                                type="search"
                                aria-label="Buscar por código, referencia u oficial"
                                value={busqueda}
                                onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
                                placeholder="Buscar por código, referencia u oficial…"
                                className="ofbol-input w-full pl-10"
                            />
                        </div>

                        <select
                            aria-label="Filtrar por tipo"
                            value={filtroTipo}
                            onChange={(e) => { setFiltroTipo(e.target.value); setPagina(1); }}
                            className="ofbol-input"
                        >
                            <option value="">Todos los tipos</option>
                            {tipos.map((t) => <option key={t.id_tipo} value={t.id_tipo}>{t.nombre}</option>)}
                        </select>

                        <select
                            aria-label="Filtrar por estado"
                            value={filtroEstado}
                            onChange={(e) => { setFiltroEstado(e.target.value); setPagina(1); }}
                            className="ofbol-input"
                        >
                            <option value="">Todos los estados</option>
                            {estados.map((e) => <option key={e.id_estado} value={e.nombre}>{e.nombre}</option>)}
                        </select>

                        <select
                            aria-label="Criterio de orden"
                            value={orden}
                            onChange={(e) => setOrden(e.target.value)}
                            className="ofbol-input"
                        >
                            <option value="fecha_desc">Más recientes</option>
                            <option value="fecha_asc">Más antiguos</option>
                            <option value="codigo">Por código</option>
                        </select>

                        {hayFiltros && (
                            <button type="button" onClick={limpiarFiltros} className="ofbol-btn-ghost">
                                Limpiar
                            </button>
                        )}
                    </div>
                </div>

                <div className="ofbol-card overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center h-56"><Spinner /></div>
                    ) : docsPagina.length === 0 ? (
                        <div className="p-4">
                            <EstadoVacio
                                icono={FileText}
                                titulo={hayFiltros ? 'Sin resultados' : 'Todavía no hay documentos'}
                                nota={
                                    hayFiltros
                                        ? 'Ningún trámite coincide con los filtros aplicados.'
                                        : 'Subí el primer memorándum para iniciar el trámite institucional.'
                                }
                                accion={
                                    hayFiltros ? (
                                        <button type="button" onClick={limpiarFiltros} className="ofbol-btn-ghost mt-1">
                                            Limpiar filtros
                                        </button>
                                    ) : null
                                }
                            />
                        </div>
                    ) : (
                        <div className="overflow-x-auto ofbol-scroll">
                            <table className="ofbol-table">
                                <thead>
                                    <tr>
                                        <th>Código</th>
                                        <th>Tipo</th>
                                        <th>Oficial</th>
                                        <th>Fecha</th>
                                        <th>Estado</th>
                                        <th className="nums">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {docsPagina.map((doc) => (
                                        <tr key={doc.id_documento}>
                                            <td className="font-mono font-bold whitespace-nowrap">{doc.codigo_documento}</td>
                                            <td className="max-w-[180px] truncate">{doc.tipo_documento?.nombre ?? '—'}</td>
                                            <td>
                                                <div className="min-w-0">
                                                    <p className="font-medium leading-tight" style={{ color: 'var(--ofbol-ink)' }}>
                                                        {doc.oficial?.nombres} {doc.oficial?.apellidos}
                                                    </p>
                                                    <p className="text-[11px]" style={{ color: 'var(--ofbol-muted)' }}>
                                                        CI: {doc.oficial?.ci ?? '—'}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap">{fechaCorta(doc.fecha_subida)}</td>
                                            <td><EstadoBadge nombre={doc.estado?.nombre ?? 'Borrador'} /></td>
                                            <td>
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setDocSeleccionado(doc)}
                                                        aria-label={`Ver el detalle de ${doc.codigo_documento}`}
                                                        title="Ver detalle"
                                                        className="p-1.5 rounded-lg transition-colors"
                                                        style={{ color: 'var(--ofbol-slate)' }}
                                                    >
                                                        <Eye size={15} />
                                                    </button>
                                                    <a
                                                        href={`/storage/${doc.ruta_pdf}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        aria-label={`Abrir el PDF de ${doc.codigo_documento}`}
                                                        title="Ver PDF"
                                                        className="p-1.5 rounded-lg transition-colors"
                                                        style={{ color: 'var(--ofbol-slate)' }}
                                                    >
                                                        <FileText size={15} />
                                                    </a>
                                                    <a
                                                        href={`/storage/${doc.ruta_pdf}`}
                                                        download
                                                        aria-label={`Descargar el PDF de ${doc.codigo_documento}`}
                                                        title="Descargar"
                                                        className="p-1.5 rounded-lg transition-colors"
                                                        style={{ color: 'var(--ofbol-slate)' }}
                                                    >
                                                        <Download size={15} />
                                                    </a>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {totalPaginas > 1 && (
                        <div
                            className="flex items-center justify-between px-4 py-3"
                            style={{ borderTop: '1px solid var(--ofbol-line)' }}
                        >
                            <p className="ofbol-etiqueta tabular-nums">
                                Página {pagina} de {totalPaginas} — {filtrados.length} resultados
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    disabled={pagina === 1}
                                    onClick={() => setPagina((p) => p - 1)}
                                    className="ofbol-btn-ghost"
                                >
                                    ← Anterior
                                </button>
                                <button
                                    type="button"
                                    disabled={pagina === totalPaginas}
                                    onClick={() => setPagina((p) => p + 1)}
                                    className="ofbol-btn-ghost"
                                >
                                    Siguiente →
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <Modal
                open={!!docSeleccionado}
                onClose={() => setDocSeleccionado(null)}
                title={`Detalle: ${docSeleccionado?.codigo_documento ?? ''}`}
                size="lg"
            >
                <DetalleDocumento doc={docSeleccionado} />
            </Modal>
        </LayoutSecretario>
    );
}
