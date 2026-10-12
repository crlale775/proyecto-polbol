/**
 * Observaciones — Bandeja de Seguimiento de Documentos Observados y Devueltos a las EPIs
 * Conecta con:
 *   - DocumentoController → GET /api/documentos (filtrando observados/devueltos)
 *   - RevisionController  → GET /api/revisiones
 *   - EpiController       → GET /api/epis
 */
import React, { useEffect, useState, useMemo } from 'react';
import { Search, FileText, Download } from 'lucide-react';
import LayoutComandoDepartamental from '../../js/components/LayoutComandoDepartamental';
import Spinner from '../../js/components/ui/Spinner';
import Alert from '../../js/components/ui/Alert';
import Modal from '../../js/components/ui/Modal';
import { ChipsDato, EstadoVacio } from '../../js/components/ui/Graficos';
import api from '../../js/lib/api';

export default function Observaciones() {
    const [documentos, setDocumentos] = useState([]);
    const [epis, setEpis] = useState([]);
    const [revisiones, setRevisiones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filtros
    const [busqueda, setBusqueda] = useState('');
    const [filtroEpi, setFiltroEpi] = useState('');

    // Modal de detalle
    const [docSeleccionado, setDocSeleccionado] = useState(null);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const [docs, listaEpis, revs] = await Promise.all([
                    api.get('/documentos'),
                    api.get('/epis'),
                    api.get('/revisiones'),
                ]);
                // Filtrar solo los que están observados o devueltos
                const filtrados = (Array.isArray(docs) ? docs : []).filter(
                    (d) => d.estado?.nombre === 'Observado' || d.estado?.nombre === 'Devuelto'
                );
                setDocumentos(filtrados);
                setEpis(Array.isArray(listaEpis) ? listaEpis : []);
                setRevisiones(Array.isArray(revs) ? revs : []);
            } catch (err) {
                setError('No se pudieron cargar las observaciones del servidor.');
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const listaFiltrada = useMemo(() => {
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
                    d.referencia?.toLowerCase().includes(q) ||
                    d.epi?.nombre?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [documentos, filtroEpi, busqueda]);

    return (
        <LayoutComandoDepartamental>
            <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 ofbol-page-enter">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="ofbol-display heading-balance">Documentos observados y devueltos</h1>
                        <p className="ofbol-nota mt-2">
                            Seguimiento de los trámites que este Comando devolvió a las EPIs y esperan subsanación.
                        </p>
                    </div>

                    <span className="ofbol-badge ofbol-badge--amber shrink-0 tabular-nums self-start sm:self-auto">
                        {listaFiltrada.length} en seguimiento
                    </span>
                </div>

                {error && <Alert type="warning" onClose={() => setError(null)}>{error}</Alert>}

                {/* Filtros */}
                <div className="ofbol-card p-4 flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[240px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--ofbol-muted)' }} aria-hidden="true" />
                        <input
                            type="search"
                            aria-label="Buscar por C.I., oficial, código o EPI"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar por C.I., oficial, código o EPI…"
                            className="ofbol-input w-full pl-9"
                        />
                    </div>

                    <select
                        aria-label="Filtrar por EPI"
                        value={filtroEpi}
                        onChange={(e) => setFiltroEpi(e.target.value)}
                        className="ofbol-input"
                    >
                        <option value="">Todas las EPIs</option>
                        {epis.map((e) => (
                            <option key={e.id_epi} value={e.id_epi}>{e.nombre}</option>
                        ))}
                    </select>

                    {(busqueda || filtroEpi) && (
                        <button
                            type="button"
                            onClick={() => { setBusqueda(''); setFiltroEpi(''); }}
                            className="ofbol-btn-ghost"
                        >
                            Limpiar
                        </button>
                    )}
                </div>

                {/* Tabla de Observados */}
                <div className="ofbol-card overflow-hidden">
                    {loading ? (
                        <div className="flex justify-center py-20"><Spinner /></div>
                    ) : listaFiltrada.length === 0 ? (
                        <div className="p-4">
                            <EstadoVacio
                                icono={FileText}
                                titulo="Sin documentos observados"
                                nota="No hay trámites devueltos a las EPIs pendientes de subsanación."
                            />
                        </div>
                    ) : (
                        <div className="overflow-x-auto ofbol-scroll">
                            <table className="ofbol-table">
                                <thead>
                                    <tr>
                                        <th>Código</th>
                                        <th>EPI responsable</th>
                                        <th>Secretario</th>
                                        <th>Oficial</th>
                                        <th>Última observación</th>
                                        <th className="nums">Detalle</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {listaFiltrada.map((doc) => {
                                        // Buscar la última revisión de este documento
                                        const revDoc = revisiones
                                            .filter((r) => r.id_documento === doc.id_documento)
                                            .toSorted((a, b) => new Date(b.fecha) - new Date(a.fecha))[0];

                                        const nombreSecretario = doc.usuario?.usuario ?? 'Secretario';
                                        const epiSecretario = doc.usuario?.epi?.nombre ?? doc.epi?.nombre ?? 'EPI';

                                        return (
                                            <tr key={doc.id_documento}>
                                                <td className="font-mono font-bold whitespace-nowrap">{doc.codigo_documento}</td>
                                                <td>
                                                    <span className="ofbol-badge ofbol-badge--amber">
                                                        {doc.epi?.nombre ?? 'EPI La Paz'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <p className="font-semibold leading-tight">{nombreSecretario}</p>
                                                    <p className="ofbol-etiqueta mt-0.5">{epiSecretario}</p>
                                                </td>
                                                <td>
                                                    <p className="font-bold leading-tight">
                                                        {doc.oficial?.grado?.abreviatura ? `${doc.oficial.grado.abreviatura} ` : ''}
                                                        {doc.oficial?.nombres} {doc.oficial?.apellidos}
                                                    </p>
                                                    <p className="text-[11px]" style={{ color: 'var(--ofbol-muted)' }}>
                                                        C.I. {doc.oficial?.ci ?? '—'}
                                                    </p>
                                                </td>
                                                <td className="max-w-xs">
                                                    <p className="line-clamp-2" style={{ color: '#7f5a07' }}>
                                                        «{revDoc?.observacion_libre ?? 'Observación emitida para corrección en la EPI.'}»
                                                    </p>
                                                    <p className="ofbol-etiqueta mt-1">
                                                        {revDoc?.fecha ? new Date(revDoc.fecha).toLocaleString('es-BO') : 'Reciente'}
                                                    </p>
                                                </td>
                                                <td className="text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => setDocSeleccionado(doc)}
                                                        className="ofbol-btn-ghost"
                                                    >
                                                        Ver detalle
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Detalle de Observación */}
            <Modal
                open={!!docSeleccionado}
                onClose={() => setDocSeleccionado(null)}
                title={`Seguimiento de Observación: ${docSeleccionado?.codigo_documento ?? ''}`}
                size="lg"
            >
                {docSeleccionado && (
                    <div className="space-y-5">
                        <div
                            className="p-4 rounded-[14px]"
                            style={{ background: 'var(--ofbol-amber-wash)', border: '1px solid rgba(154, 111, 10, 0.28)' }}
                        >
                            <p className="ofbol-etiqueta" style={{ color: '#7f5a07' }}>Estado de la devolución</p>
                            <p className="text-sm font-bold mt-1" style={{ color: 'var(--ofbol-ink)' }}>
                                Devuelto a {docSeleccionado.usuario?.epi?.nombre ?? docSeleccionado.epi?.nombre ?? 'la EPI'}
                                {' — '}
                                {docSeleccionado.usuario?.usuario ?? 'Secretario'}
                            </p>
                            <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--ofbol-ink-soft)' }}>
                                La EPI debe subsanar el documento y adjuntar el archivo corregido para un nuevo
                                reenvío a este Comando.
                            </p>
                        </div>

                        <ChipsDato
                            datos={[
                                {
                                    etiqueta: 'Oficial',
                                    valor:
                                        `${docSeleccionado.oficial?.grado?.abreviatura ?? ''} ${docSeleccionado.oficial?.nombres ?? ''} ${docSeleccionado.oficial?.apellidos ?? ''}`.trim() || '—',
                                },
                                { etiqueta: 'Tipo de trámite', valor: docSeleccionado.tipo_documento?.nombre ?? 'Memorándum' },
                            ]}
                        />

                        <div className="flex justify-end">
                            <a href={`/storage/${docSeleccionado.ruta_pdf}`} download className="ofbol-btn-ghost">
                                <Download size={14} />
                                Descargar copia
                            </a>
                        </div>
                    </div>
                )}
            </Modal>
        </LayoutComandoDepartamental>
    );
}
