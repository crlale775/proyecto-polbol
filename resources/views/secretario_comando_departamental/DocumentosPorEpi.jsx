/**
 * DocumentosPorEpi — CAMPUS POLICIAL (Comando Departamental de La Paz)
 *
 * Las 9 Estaciones Policiales Integrales se muestran como EDIFICIOS 3D
 * clickeables (CSS puro). Las ventanas se iluminan según la carga real:
 *   ámbar = en revisión · rojo = observados · verde = aprobados.
 *
 * MODO EN VIVO: los contadores y la tabla se actualizan solos — un
 * documento subido desde la EPI en otra ventana aparece aquí sin recargar
 * (toasts + evento global ofbol:sync del SyncProvider).
 *
 * La vista usa el sistema: `.ofbol-card` para la estructura, `KpiPanel` para
 * las cifras, `.ofbol-table` para la tabla, `EstadoVacio` para el vacío y el
 * `Modal` compartido para el detalle.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Search } from 'lucide-react';
import LayoutComandoDepartamental from '../../js/components/LayoutComandoDepartamental';
import EstadoBadge from '../../js/components/ui/EstadoBadge';
import Spinner from '../../js/components/ui/Spinner';
import Alert from '../../js/components/ui/Alert';
import Modal from '../../js/components/ui/Modal';
import EdificioEPI from '../../js/components/ui/EdificioEPI';
import { ChipEnVivo, useSyncGlobal } from '../../js/components/ui/ToastEnVivo';
import { ChipsDato, EstadoVacio } from '../../js/components/ui/Graficos';
import { KpiPanel, ACENTOS } from '../../js/components/ui/Panel';
import api from '../../js/lib/api';

const fechaCorta = (f) =>
    f ? new Date(f).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function DocumentosPorEpi() {
    const { conectado } = useSyncGlobal();
    const [documentos, setDocumentos] = useState([]);
    const [epis, setEpis] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [epiSeleccionada, setEpiSeleccionada] = useState(null);
    const [busqueda, setBusqueda] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('todos');
    const [docModal, setDocModal] = useState(null);
    const [destello, setDestello] = useState({});

    const cargarDocumentos = useCallback(async () => {
        const docsRes = await api.get('/documentos');
        if (Array.isArray(docsRes)) setDocumentos(docsRes);
    }, []);

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);
                const [docsRes, episRes] = await Promise.all([
                    api.get('/documentos'),
                    api.get('/epis'),
                ]);
                if (Array.isArray(docsRes)) setDocumentos(docsRes);
                if (Array.isArray(episRes)) setEpis(episRes);
            } catch (err) {
                setError('No se pudo cargar la carga documental del departamento.');
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    // ── EN VIVO: refresco cuando el SyncProvider detecta movimiento ──
    useEffect(() => {
        const onSync = () => {
            cargarDocumentos().catch(() => {});
            setDestello((d) => ({ ...d, tick: Date.now() }));
        };
        window.addEventListener('ofbol:sync', onSync);
        return () => window.removeEventListener('ofbol:sync', onSync);
    }, [cargarDocumentos]);

    // Selección por defecto: primera EPI (valor derivado, sin estado sincronizado:
    // epiEfectiva resuelve null durante el primer render sin effects encadenados)
    const epiEfectiva = epiSeleccionada ?? epis[0]?.id_epi ?? null;

    // Resumen por EPI calculado de los documentos reales (no del sync: la tabla manda)
    const resumenPorEpi = {};
    documentos.forEach((d) => {
        const id = d.id_epi;
        resumenPorEpi[id] = resumenPorEpi[id] || { total: 0, en_revision: 0, observados: 0, aprobados: 0 };
        resumenPorEpi[id].total += 1;
        if ([2, 3].includes(d.estado_actual)) resumenPorEpi[id].en_revision += 1;
        if ([4, 5].includes(d.estado_actual)) resumenPorEpi[id].observados += 1;
        if ([6, 7, 8].includes(d.estado_actual)) resumenPorEpi[id].aprobados += 1;
    });

    const abrirEpi = (idEpi) => {
        setEpiSeleccionada(idEpi);
        document.getElementById('campus-detalle')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const epiActual = epis.find((e) => e.id_epi === epiEfectiva) || epis[0];
    const docsEpi = documentos.filter((d) => d.id_epi === epiEfectiva);

    const filtrados = docsEpi.filter((d) => {
        const q = busqueda.toLowerCase();
        const codigo = d.codigo_documento?.toLowerCase() || '';
        const oficial = `${d.oficial?.nombres || ''} ${d.oficial?.apellidos || ''}`.toLowerCase();
        const tipo = d.tipo_documento?.nombre?.toLowerCase() || '';
        const coincideBusqueda = codigo.includes(q) || oficial.includes(q) || tipo.includes(q);

        if (filtroEstado === 'todos') return coincideBusqueda;
        return coincideBusqueda && String(d.estado_actual) === String(filtroEstado);
    });

    // Métricas de la EPI seleccionada
    const totalDocs = docsEpi.length;
    const pendientes = docsEpi.filter((d) => [2, 3].includes(d.estado_actual)).length;
    const observados = docsEpi.filter((d) => [4, 5].includes(d.estado_actual)).length;
    const aprobados = docsEpi.filter((d) => [6, 7, 8].includes(d.estado_actual)).length;

    const hayFiltros = !!(busqueda.trim() || filtroEstado !== 'todos');
    const limpiarFiltros = () => {
        setBusqueda('');
        setFiltroEstado('todos');
    };

    return (
        <LayoutComandoDepartamental>
            <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 ofbol-page-enter">
                {/* Encabezado */}
                <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="ofbol-display heading-balance">Campus Policial</h1>
                        <p className="ofbol-nota mt-2">
                            Las {epis.length || 9} Estaciones Policiales Integrales de la jurisdicción,
                            cada una como edificio. Sus ventanas se iluminan según la carga documental
                            real: hacé clic en una para entrar a su jurisdicción.
                        </p>
                    </div>
                    <ChipEnVivo conectado={conectado} />
                </header>

                {error && <Alert type="warning" onClose={() => setError(null)}>{error}</Alert>}

                {loading ? (
                    <div className="py-24 flex justify-center">
                        <Spinner />
                    </div>
                ) : (
                    <>
                        {/* ═══ CAMPUS DE EDIFICIOS ═══ */}
                        <div className="ofbol-campus">
                            <div className="ofbol-campus-grid">
                                {epis.map((epi, i) => (
                                    <EdificioEPI
                                        key={`${epi.id_epi}-${destello.tick ?? 0}`}
                                        epi={epi}
                                        resumen={resumenPorEpi[epi.id_epi]}
                                        index={i}
                                        activa={epiEfectiva === epi.id_epi}
                                        onClick={() => abrirEpi(epi.id_epi)}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* ═══ LA EPI SELECCIONADA Y SUS FILTROS ═══ */}
                        <section id="campus-detalle" className="ofbol-card p-5 scroll-mt-24">
                            <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="ofbol-etiqueta">EPI seleccionada</p>
                                    <h2 className="text-lg font-black mt-1" style={{ color: 'var(--ofbol-ink)' }}>
                                        {epiActual?.nombre ?? 'Estación Policial Integral'}
                                    </h2>
                                    <p className="ofbol-nota mt-0.5">
                                        {epiActual?.ubicacion || epiActual?.direccion || 'Jurisdicción Policial de La Paz'}
                                    </p>
                                </div>
                                <p className="ofbol-etiqueta tabular-nums shrink-0">
                                    {totalDocs} trámite{totalDocs === 1 ? '' : 's'}
                                </p>
                            </header>

                            <div
                                className="flex flex-col sm:flex-row gap-3 mt-5 pt-4"
                                style={{ borderTop: '1px solid var(--ofbol-line)' }}
                            >
                                <div className="relative flex-1 min-w-48">
                                    <Search
                                        size={15}
                                        className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                                        style={{ color: 'var(--ofbol-muted)' }}
                                        aria-hidden="true"
                                    />
                                    <input
                                        type="search"
                                        aria-label="Buscar por código de memorándum, oficial o tipo"
                                        value={busqueda}
                                        onChange={(e) => setBusqueda(e.target.value)}
                                        placeholder="Buscar por código, oficial o tipo…"
                                        className="ofbol-input w-full pl-10"
                                    />
                                </div>
                                <select
                                    aria-label="Filtrar por estado"
                                    value={filtroEstado}
                                    onChange={(e) => setFiltroEstado(e.target.value)}
                                    className="ofbol-input"
                                >
                                    <option value="todos">Todos los estados</option>
                                    <option value="2">Enviados por EPI</option>
                                    <option value="3">En revisión</option>
                                    <option value="4">Observados</option>
                                    <option value="6">Aprobados</option>
                                    <option value="8">Registrados</option>
                                </select>
                                {hayFiltros && (
                                    <button type="button" onClick={limpiarFiltros} className="ofbol-btn-ghost">
                                        Limpiar
                                    </button>
                                )}
                            </div>
                        </section>

                        {/* ═══ CIFRAS DE LA EPI (una sola cifra líder: el total) ═══ */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <KpiPanel etiqueta="Total" valor={totalDocs} acento={ACENTOS.steel} grande />
                            <KpiPanel etiqueta="En revisión" valor={pendientes} acento={ACENTOS.ambar} />
                            <KpiPanel etiqueta="Observados" valor={observados} acento={ACENTOS.rust} />
                            <KpiPanel etiqueta="Aprobados" valor={aprobados} acento={ACENTOS.teal} />
                        </div>

                        {/* ═══ TABLA DE DOCUMENTOS ═══ */}
                        <section className="ofbol-card overflow-hidden">
                            <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
                                <h2 className="ofbol-titulo-seccion">Trámites de la EPI</h2>
                                {filtrados.length !== totalDocs && (
                                    <p className="ofbol-etiqueta tabular-nums">
                                        {filtrados.length} de {totalDocs}
                                    </p>
                                )}
                            </header>

                            {filtrados.length === 0 ? (
                                <EstadoVacio
                                    compacto
                                    icono={FileText}
                                    titulo={hayFiltros ? 'Sin resultados' : 'Sin trámites en esta EPI'}
                                    nota={
                                        hayFiltros
                                            ? 'Ningún trámite de esta estación coincide con los filtros aplicados.'
                                            : 'Cuando la EPI envíe un memorándum, aparecerá acá y encenderá las ventanas del edificio.'
                                    }
                                    accion={
                                        hayFiltros ? (
                                            <button type="button" onClick={limpiarFiltros} className="ofbol-btn-ghost mt-1">
                                                Limpiar filtros
                                            </button>
                                        ) : null
                                    }
                                />
                            ) : (
                                <div className="overflow-x-auto ofbol-scroll">
                                    <table className="ofbol-table">
                                        <thead>
                                            <tr>
                                                <th>Código</th>
                                                <th>Tipo</th>
                                                <th>Oficial destinatario</th>
                                                <th>Fecha de emisión</th>
                                                <th>Estado</th>
                                                <th className="nums">Detalle</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtrados.map((doc) => (
                                                <tr key={doc.id_documento} className="ofbol-fila-nueva">
                                                    <td className="font-mono font-bold whitespace-nowrap">
                                                        {doc.codigo_documento}
                                                    </td>
                                                    <td className="max-w-[180px] truncate">
                                                        {doc.tipo_documento?.nombre ?? '—'}
                                                    </td>
                                                    <td>
                                                        <div className="min-w-0">
                                                            <p className="font-medium leading-tight" style={{ color: 'var(--ofbol-ink)' }}>
                                                                {doc.oficial?.nombres} {doc.oficial?.apellidos}
                                                            </p>
                                                            <p className="text-[11px]" style={{ color: 'var(--ofbol-muted)' }}>
                                                                {doc.oficial?.grado?.nombre ?? 'Oficial'} · CI: {doc.oficial?.ci ?? '—'}
                                                            </p>
                                                        </div>
                                                    </td>
                                                    <td className="whitespace-nowrap">{fechaCorta(doc.fecha_subida)}</td>
                                                    <td>
                                                        <EstadoBadge nombre={doc.estado?.nombre ?? 'En trámite'} />
                                                    </td>
                                                    <td>
                                                        <div className="flex items-center justify-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => setDocModal(doc)}
                                                                aria-label={`Inspeccionar ${doc.codigo_documento}`}
                                                                className="ofbol-btn-ghost !py-1.5 !px-3"
                                                            >
                                                                Inspeccionar
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    </>
                )}
            </div>

            {/* Detalle del trámite */}
            <Modal
                open={!!docModal}
                onClose={() => setDocModal(null)}
                title={docModal?.codigo_documento ?? 'Detalle del trámite'}
                size="lg"
            >
                {docModal && (
                    <div className="space-y-5">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="font-mono font-black text-[15px]" style={{ color: 'var(--ofbol-ink)' }}>
                                    {docModal.codigo_documento}
                                </p>
                                <p className="ofbol-etiqueta mt-0.5">
                                    {docModal.tipo_documento?.nombre ?? '—'}
                                </p>
                            </div>
                            <EstadoBadge nombre={docModal.estado?.nombre ?? 'En trámite'} />
                        </div>

                        <ChipsDato
                            datos={[
                                { etiqueta: 'EPI', valor: docModal.epi?.nombre ?? epiActual?.nombre ?? '—' },
                                {
                                    etiqueta: 'Oficial',
                                    valor:
                                        `${docModal.oficial?.nombres ?? ''} ${docModal.oficial?.apellidos ?? ''}`.trim() || '—',
                                },
                                { etiqueta: 'Grado', valor: docModal.oficial?.grado?.nombre ?? '—' },
                                { etiqueta: 'Emisión', valor: fechaCorta(docModal.fecha_subida) },
                                { etiqueta: 'Referencia', valor: docModal.referencia ?? '—' },
                            ]}
                        />

                        <div>
                            <p className="ofbol-etiqueta mb-2">Firma digital · SHA-256</p>
                            {docModal.hash ? (
                                <p
                                    className="font-mono text-[10px] p-2.5 rounded-[10px] break-all"
                                    style={{
                                        background: '#f4f2ec',
                                        border: '1px solid var(--ofbol-line)',
                                        color: 'var(--ofbol-ink-soft)',
                                    }}
                                >
                                    {docModal.hash}
                                </p>
                            ) : (
                                <p className="ofbol-vacio-nota">
                                    Este trámite todavía no tiene sello digital emitido.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </LayoutComandoDepartamental>
    );
}
