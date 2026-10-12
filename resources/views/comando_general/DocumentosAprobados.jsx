/**
 * DocumentosAprobados.jsx — Bandeja de Entrada y Validación Oficial
 * Comando General de la Policía Boliviana
 * Estilo visual limpio y escaneable (PolBol / Claude design)
 */
import React, { useEffect, useState, useMemo } from 'react';
import { Inbox, RefreshCw, Search } from 'lucide-react';
import LayoutComandoGeneral from '../../js/components/LayoutComandoGeneral';
import EstadoBadge from '../../js/components/ui/EstadoBadge';
import Spinner from '../../js/components/ui/Spinner';
import Alert from '../../js/components/ui/Alert';
import Modal from '../../js/components/ui/Modal';
import { useConfirmar } from '../../js/components/ui/ConfirmDialog';
import { ChipsDato, EstadoVacio } from '../../js/components/ui/Graficos';
import { useAuth } from '../../js/context/AuthContext';
import api from '../../js/lib/api';

const fechaCorta = (f) =>
    f ? new Date(f).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function DocumentosAprobados() {
    const { user } = useAuth();
    const [documentos, setDocumentos] = useState([]);
    const [epis, setEpis] = useState([]);
    const [tipos, setTipos] = useState([]);
    const [estados, setEstados] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [alertaAccion, setAlertaAccion] = useState(null);

    // Filtros
    const [busqueda, setBusqueda] = useState('');
    const [filtroEpi, setFiltroEpi] = useState('');
    const [filtroTipo, setFiltroTipo] = useState('');
    const [filtroTab, setFiltroTab] = useState('pendientes'); // 'pendientes' | 'registrados' | 'todos'

    // Modal
    const [docSeleccionado, setDocSeleccionado] = useState(null);
    const [detalleDoc, setDetalleDoc] = useState(null);
    const [revisionesDoc, setRevisionesDoc] = useState([]);
    const [cargandoDetalle, setCargandoDetalle] = useState(false);
    const [procesandoRegistro, setProcesandoRegistro] = useState(false);

    // Devolución
    const [modalDevolucion, setModalDevolucion] = useState(false);
    const [motivoDevolucion, setMotivoDevolucion] = useState('');
    const [procesandoDevolucion, setProcesandoDevolucion] = useState(false);

    // Confirmación de acciones irreversibles (reemplaza a window.confirm).
    const { pedir, Confirmacion } = useConfirmar();

    const cargarDatos = async () => {
        setLoading(true);
        try {
            const [docs, listaEpis, tDocs, eDocs] = await Promise.all([
                api.get('/documentos'),
                api.get('/epis'),
                api.get('/tipos-documento'),
                api.get('/estados-documento'),
            ]);

            const aprobados = (Array.isArray(docs) ? docs : []).filter(
                (d) =>
                    d.estado?.nombre === 'Aprobado' ||
                    d.estado?.nombre === 'Remitido al Comando General' ||
                    d.estado?.nombre === 'Registrado'
            );

            setDocumentos(aprobados);
            setEpis(Array.isArray(listaEpis) ? listaEpis : []);
            setTipos(Array.isArray(tDocs) ? tDocs : []);
            setEstados(Array.isArray(eDocs) ? eDocs : []);
        } catch (err) {
            setError('No se pudieron cargar los documentos del servidor.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarDatos();
    }, []);

    const abrirDetalle = async (doc) => {
        setDocSeleccionado(doc);
        setDetalleDoc(null);
        setRevisionesDoc([]);
        setMotivoDevolucion('');
        setModalDevolucion(false);
        setCargandoDetalle(true);
        try {
            const [data, revs] = await Promise.all([
                api.get(`/documentos/${doc.id_documento}`),
                api.get(`/revisiones?id_documento=${doc.id_documento}`).catch(() => []),
            ]);
            setDetalleDoc(data);
            setRevisionesDoc(Array.isArray(revs) ? revs : []);
        } catch (_) {
            setDetalleDoc(doc);
        } finally {
            setCargandoDetalle(false);
        }
    };

    const getRevisorDptalId = () => {
        const revAprobada = [...revisionesDoc]
            .toSorted((a, b) => new Date(b.fecha) - new Date(a.fecha))
            .find(
                (r) =>
                    (r.nivel_revision?.toLowerCase().includes('departamental') ||
                        r.nivel_revision?.toLowerCase().includes('comando')) &&
                    r.estado?.toLowerCase().includes('aprob')
            );
        return revAprobada?.usuario_revisor ?? revAprobada?.revisor?.id_usuario ?? null;
    };

    // Filtros
    const docsFiltrados = useMemo(() => {
        let list = [...documentos];

        if (filtroTab === 'pendientes') {
            list = list.filter((d) => d.estado?.nombre !== 'Registrado');
        } else if (filtroTab === 'registrados') {
            list = list.filter((d) => d.estado?.nombre === 'Registrado');
        }

        if (filtroEpi) {
            list = list.filter((d) => d.id_epi === parseInt(filtroEpi, 10));
        }
        if (filtroTipo) {
            list = list.filter((d) => d.id_tipo === parseInt(filtroTipo, 10));
        }
        if (busqueda.trim()) {
            const q = busqueda.toLowerCase();
            list = list.filter(
                (d) =>
                    d.codigo_documento?.toLowerCase().includes(q) ||
                    d.referencia?.toLowerCase().includes(q) ||
                    d.oficial?.nombres?.toLowerCase().includes(q) ||
                    d.oficial?.apellidos?.toLowerCase().includes(q) ||
                    d.oficial?.ci?.includes(q) ||
                    d.epi?.nombre?.toLowerCase().includes(q)
            );
        }

        return list.toSorted((a, b) => new Date(b.fecha_subida) - new Date(a.fecha_subida));
    }, [documentos, filtroTab, filtroEpi, filtroTipo, busqueda]);

    // Validación y Cierre de Flujo
    const handleValidarYCerrar = async () => {
        if (!docSeleccionado) return;
        const confirmado = await pedir({
            titulo: 'Validar y cerrar el trámite',
            mensaje: `Se registrará oficialmente el memorándum ${docSeleccionado.codigo_documento} en el escalafón.`,
            detalle: 'El flujo institucional quedará cerrado.',
            tono: 'oliva',
            confirmarTexto: 'Registrar y cerrar',
        });
        if (!confirmado) return;

        setProcesandoRegistro(true);
        try {
            const estadoRegistrado = estados.find((e) => e.nombre === 'Registrado');
            const idEstadoRegistrado = estadoRegistrado ? estadoRegistrado.id_estado : 6;

            await api.put(`/documentos/${docSeleccionado.id_documento}`, {
                ...docSeleccionado,
                estado_actual: idEstadoRegistrado,
                usuario_cambio: user?.id_usuario ?? 1,
            });

            await api.post('/revisiones', {
                id_documento: docSeleccionado.id_documento,
                usuario_revisor: user?.id_usuario ?? 1,
                nivel_revision: 'Comando General',
                estado: 'Aprobado',
                observacion_libre: 'Documento validado y registrado oficialmente en escalafón por Comando General.',
                fecha: new Date().toISOString(),
            }).catch(() => {});

            if (docSeleccionado.id_usuario) {
                await api.post('/notificaciones', {
                    id_usuario: docSeleccionado.id_usuario,
                    id_documento: docSeleccionado.id_documento,
                    titulo: `${docSeleccionado.codigo_documento} — Registrado Oficialmente`,
                    mensaje: `El Comando General validó y registró formalmente su documento. Flujo institucional CERRADO.`,
                    leido: false,
                    fecha: new Date().toISOString(),
                }).catch(() => {});
            }

            const idRevisorDptal = getRevisorDptalId();
            if (idRevisorDptal) {
                await api.post('/notificaciones', {
                    id_usuario: idRevisorDptal,
                    id_documento: docSeleccionado.id_documento,
                    titulo: `${docSeleccionado.codigo_documento} — Trámite Concluido`,
                    mensaje: `El Comando General ha registrado formalmente el memorándum remitido por su instancia.`,
                    leido: false,
                    fecha: new Date().toISOString(),
                }).catch(() => {});
            }

            setAlertaAccion({
                tipo: 'success',
                mensaje: `El documento ${docSeleccionado.codigo_documento} ha sido registrado oficialmente.`,
            });

            setDocSeleccionado(null);
            cargarDatos();
        } catch (err) {
            setAlertaAccion({
                tipo: 'error',
                mensaje: `Error al registrar: ${err.message}`,
            });
        } finally {
            setProcesandoRegistro(false);
        }
    };

    // Devolución por observación
    const handleDevolverConObservacion = async () => {
        if (!docSeleccionado) return;
        if (!motivoDevolucion.trim()) {
            setAlertaAccion({ tipo: 'warning', mensaje: 'Ingrese el motivo de observación para la devolución.' });
            return;
        }

        setProcesandoDevolucion(true);
        try {
            const estadoObservado = estados.find((e) => e.nombre?.toLowerCase().includes('observ'));
            const idEstadoObservado = estadoObservado ? estadoObservado.id_estado : 4;

            await api.put(`/documentos/${docSeleccionado.id_documento}`, {
                ...docSeleccionado,
                estado_actual: idEstadoObservado,
                usuario_cambio: user?.id_usuario ?? 1,
            });

            await api.post('/revisiones', {
                id_documento: docSeleccionado.id_documento,
                usuario_revisor: user?.id_usuario ?? 1,
                nivel_revision: 'Comando General',
                estado: 'Observado',
                observacion_libre: motivoDevolucion.trim(),
                fecha: new Date().toISOString(),
            }).catch(() => {});

            const idRevisorDptal = getRevisorDptalId();
            if (idRevisorDptal) {
                await api.post('/notificaciones', {
                    id_usuario: idRevisorDptal,
                    id_documento: docSeleccionado.id_documento,
                    titulo: `${docSeleccionado.codigo_documento} — Devuelto por Cmd. General`,
                    mensaje: `Observación del Comando General: "${motivoDevolucion}".`,
                    leido: false,
                    fecha: new Date().toISOString(),
                }).catch(() => {});
            }

            if (docSeleccionado.id_usuario) {
                await api.post('/notificaciones', {
                    id_usuario: docSeleccionado.id_usuario,
                    id_documento: docSeleccionado.id_documento,
                    titulo: `${docSeleccionado.codigo_documento} — Observado por Cmd. General`,
                    mensaje: `Observación: "${motivoDevolucion}". En revisión por Comando Departamental.`,
                    leido: false,
                    fecha: new Date().toISOString(),
                }).catch(() => {});
            }

            setAlertaAccion({
                tipo: 'error',
                mensaje: `El documento ${docSeleccionado.codigo_documento} ha sido devuelto con observación.`,
            });

            setModalDevolucion(false);
            setMotivoDevolucion('');
            setDocSeleccionado(null);
            cargarDatos();
        } catch (err) {
            setAlertaAccion({
                tipo: 'error',
                mensaje: `Error al devolver: ${err.message}`,
            });
        } finally {
            setProcesandoDevolucion(false);
        }
    };

    const yaRegistrado = docSeleccionado?.estado?.nombre === 'Registrado';

    return (
        <LayoutComandoGeneral>
            <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 ofbol-page-enter">

                {/* Encabezado */}
                <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="ofbol-display heading-balance">Bandeja de validación</h1>
                        <p className="ofbol-nota mt-2">
                            Trámites aprobados por el Comando Departamental que esperan el registro
                            oficial de la Dirección de Personal. Desde acá se cierra el flujo o se
                            devuelve con observación.
                        </p>
                    </div>

                    <button type="button" onClick={cargarDatos} className="ofbol-btn-ghost self-start shrink-0">
                        <RefreshCw size={14} aria-hidden="true" /> Actualizar
                    </button>
                </header>

                {alertaAccion && (
                    <Alert type={alertaAccion.tipo} onClose={() => setAlertaAccion(null)}>
                        {alertaAccion.mensaje}
                    </Alert>
                )}

                {error && <Alert type="error" onClose={() => setError(null)}>{error}</Alert>}

                {/* Filtros */}
                <div className="ofbol-card p-4">
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                        <div
                            className="flex gap-1 p-1 rounded-[12px] shrink-0 flex-wrap"
                            style={{ background: '#f4f2ec', border: '1px solid var(--ofbol-line)' }}
                            role="group"
                            aria-label="Filtrar por categoría de trámite"
                        >
                            {[
                                { id: 'pendientes', label: 'Pendientes de validación' },
                                { id: 'registrados', label: 'Registrados (cerrados)' },
                                { id: 'todos', label: 'Todos los documentos' },
                            ].map((tab) => {
                                const activo = filtroTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        aria-pressed={activo}
                                        onClick={() => setFiltroTab(tab.id)}
                                        className="px-3.5 py-1.5 text-xs font-bold rounded-[9px]"
                                        style={
                                            activo
                                                ? { background: 'var(--ofbol-olive)', color: '#fbfaf6' }
                                                : { background: 'transparent', color: 'var(--ofbol-slate)' }
                                        }
                                    >
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex items-center gap-2 flex-1 max-w-xl">
                            <div className="relative flex-1 min-w-40">
                                <Search
                                    size={15}
                                    className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                                    style={{ color: 'var(--ofbol-muted)' }}
                                    aria-hidden="true"
                                />
                                <input
                                    type="search"
                                    aria-label="Buscar por código, referencia, oficial o CI"
                                    value={busqueda}
                                    onChange={(e) => setBusqueda(e.target.value)}
                                    placeholder="Buscar por memo, oficial, CI…"
                                    className="ofbol-input w-full pl-10"
                                />
                            </div>

                            <select
                                aria-label="Filtrar por EPI de origen"
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
                    </div>
                </div>

                {/* Lista */}
                <section className="ofbol-card overflow-hidden">
                    {loading ? (
                        <div className="py-24 flex justify-center"><Spinner /></div>
                    ) : docsFiltrados.length === 0 ? (
                        <div className="p-4">
                            <EstadoVacio
                                icono={Inbox}
                                titulo="Sin documentos en esta categoría"
                                nota="No se encontraron trámites con la pestaña y los filtros aplicados."
                            />
                        </div>
                    ) : (
                        <div className="overflow-x-auto ofbol-scroll">
                            <table className="ofbol-table">
                                <thead>
                                    <tr>
                                        <th>Código / Trámite</th>
                                        <th>Oficial destinatario</th>
                                        <th>EPI de origen</th>
                                        <th>Fecha</th>
                                        <th>Estado</th>
                                        <th className="nums">Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {docsFiltrados.map((doc) => {
                                        const cerrado = doc.estado?.nombre === 'Registrado';
                                        const fecha = fechaCorta(doc.fecha_subida);

                                        return (
                                            <tr key={doc.id_documento}>
                                                <td className="whitespace-nowrap">
                                                    <p className="font-mono font-bold" style={{ color: 'var(--ofbol-ink)' }}>{doc.codigo_documento}</p>
                                                    <p className="text-[11px] max-w-xs truncate" style={{ color: 'var(--ofbol-muted)' }}>{doc.referencia}</p>
                                                </td>
                                                <td>
                                                    <p className="font-medium leading-tight" style={{ color: 'var(--ofbol-ink)' }}>
                                                        {doc.oficial?.grado?.abreviatura ? `${doc.oficial.grado.abreviatura} ` : ''}
                                                        {doc.oficial?.nombres} {doc.oficial?.apellidos}
                                                    </p>
                                                    <p className="text-[11px]" style={{ color: 'var(--ofbol-muted)' }}>CI: {doc.oficial?.ci || '—'}</p>
                                                </td>
                                                <td>
                                                    <span className="ofbol-chip">{doc.epi?.nombre || 'EPI'}</span>
                                                </td>
                                                <td className="whitespace-nowrap">{fecha}</td>
                                                <td>
                                                    <EstadoBadge nombre={doc.estado?.nombre || 'Pendiente'} />
                                                </td>
                                                <td className="nums whitespace-nowrap">
                                                    <button
                                                        type="button"
                                                        onClick={() => abrirDetalle(doc)}
                                                        className={cerrado ? 'ofbol-btn-ghost !py-1.5 !px-3' : 'ofbol-btn-primary !py-1.5 !px-3'}
                                                        aria-label={
                                                            cerrado
                                                                ? `Ver el registro de ${doc.codigo_documento}`
                                                                : `Revisar ${doc.codigo_documento}`
                                                        }
                                                    >
                                                        {cerrado ? 'Ver registro' : 'Revisar →'}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {/* Modal: validación y devolución */}
                <Modal
                    open={!!docSeleccionado}
                    onClose={() => setDocSeleccionado(null)}
                    title={`Trámite: ${docSeleccionado?.codigo_documento || ''}`}
                    size="xl"
                >
                    {docSeleccionado && (
                        <div className="space-y-5">
                            {/* Banner Resumen */}
                            <div
                                className="rounded-[14px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                style={{ background: 'var(--ofbol-olive)', color: '#fbfaf6' }}
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-sm font-black">
                                            {docSeleccionado.codigo_documento}
                                        </span>
                                        <EstadoBadge nombre={docSeleccionado.estado?.nombre || 'Aprobado'} />
                                    </div>
                                    <p className="text-xs mt-0.5" style={{ color: 'rgba(251,250,246,0.74)' }}>
                                        {docSeleccionado.referencia}
                                    </p>
                                </div>
                                <a
                                    href={`/storage/${docSeleccionado.ruta_pdf}`}
                                    download
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-xs font-bold shrink-0 self-start"
                                    style={{
                                        background: 'rgba(251,250,246,0.14)',
                                        border: '1px solid rgba(251,250,246,0.26)',
                                        color: '#fbfaf6',
                                    }}
                                >
                                    Descargar PDF
                                </a>
                            </div>

                            {/* Ficha del trámite: los datos se leen de un vistazo */}
                            <ChipsDato
                                datos={[
                                    {
                                        etiqueta: 'Oficial',
                                        valor:
                                            `${docSeleccionado.oficial?.grado?.abreviatura ? `${docSeleccionado.oficial.grado.abreviatura} ` : ''}${docSeleccionado.oficial?.nombres ?? ''} ${docSeleccionado.oficial?.apellidos ?? ''}`.trim() || '—',
                                    },
                                    { etiqueta: 'C.I.', valor: docSeleccionado.oficial?.ci || '—' },
                                    { etiqueta: 'Origen', valor: docSeleccionado.epi?.nombre || '—' },
                                    {
                                        etiqueta: 'Remitido por',
                                        valor: docSeleccionado.usuario?.usuario || 'Secretario de EPI',
                                    },
                                    { etiqueta: 'Emisión', valor: fechaCorta(docSeleccionado.fecha_subida) },
                                ]}
                            />

                            <div>
                                <p className="ofbol-etiqueta mb-1.5">Firma digital · SHA-256</p>
                                {docSeleccionado.hash ? (
                                    <p
                                        className="font-mono text-[10px] p-2.5 rounded-[10px] break-all"
                                        style={{
                                            background: '#f4f2ec',
                                            border: '1px solid var(--ofbol-line)',
                                            color: 'var(--ofbol-ink-soft)',
                                        }}
                                    >
                                        {docSeleccionado.hash}
                                    </p>
                                ) : (
                                    <p className="ofbol-vacio-nota">
                                        Este trámite todavía no tiene sello digital emitido.
                                    </p>
                                )}
                            </div>

                            {/* Visor PDF */}
                            <div className="rounded-[14px] overflow-hidden" style={{ background: 'var(--ofbol-ink)' }}>
                                <iframe
                                    src={`/storage/${docSeleccionado.ruta_pdf}`}
                                    className="w-full h-72"
                                    style={{ background: 'var(--ofbol-ink)' }}
                                    title={`Documento ${docSeleccionado.codigo_documento}`}
                                />
                            </div>

                            {/* Formulario de Devolución si se activa */}
                            {modalDevolucion && !yaRegistrado && (
                                <div
                                    className="p-4 rounded-[14px] space-y-2.5"
                                    style={{
                                        background: 'var(--ofbol-crimson-wash)',
                                        border: '1px solid rgba(143, 32, 32, 0.22)',
                                    }}
                                >
                                    <label htmlFor="motivo-devolucion" className="ofbol-etiqueta block">
                                        Motivo de devolución al Comando Departamental y a la EPI
                                    </label>
                                    <textarea
                                        id="motivo-devolucion"
                                        value={motivoDevolucion}
                                        onChange={(e) => setMotivoDevolucion(e.target.value)}
                                        placeholder="Describa qué debe corregirse…"
                                        rows={3}
                                        className="ofbol-input w-full"
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button type="button" onClick={() => setModalDevolucion(false)} className="ofbol-btn-ghost">
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleDevolverConObservacion}
                                            disabled={procesandoDevolucion || !motivoDevolucion.trim()}
                                            className="ofbol-btn-danger"
                                        >
                                            {procesandoDevolucion ? 'Devolviendo…' : 'Confirmar devolución'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Botones de Acción */}
                            <div
                                className="flex items-center justify-between gap-3 flex-wrap pt-4"
                                style={{ borderTop: '1px solid var(--ofbol-line)' }}
                            >
                                <button type="button" onClick={() => setDocSeleccionado(null)} className="ofbol-btn-ghost">
                                    Cerrar
                                </button>

                                {yaRegistrado ? (
                                    <span
                                        className="ofbol-chip"
                                        style={{ background: 'var(--ofbol-teal-wash)', color: 'var(--ofbol-teal)' }}
                                    >
                                        Trámite registrado oficialmente
                                    </span>
                                ) : (
                                    <div className="flex gap-2 flex-wrap">
                                        {!modalDevolucion && (
                                            <button
                                                type="button"
                                                onClick={() => setModalDevolucion(true)}
                                                className="ofbol-btn-danger"
                                            >
                                                Devolver con observación
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleValidarYCerrar}
                                            disabled={procesandoRegistro}
                                            className="ofbol-btn-primary"
                                        >
                                            {procesandoRegistro ? 'Registrando…' : 'Validar y cerrar flujo'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </Modal>
                {Confirmacion}
            </div>
        </LayoutComandoGeneral>
    );
}
