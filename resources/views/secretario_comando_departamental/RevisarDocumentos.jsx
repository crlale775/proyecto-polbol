/**
 * RevisarDocumentos — Cola de Trabajo y Bandeja de Revisión del Comando Departamental de La Paz
 * Conecta con:
 *   - DocumentoController        → GET /api/documentos, PUT /api/documentos/{id}
 *   - RevisionController         → GET /api/revisiones, POST /api/revisiones
 *   - HistorialEstadoController  → POST /api/historial-estados
 *   - NotificacionController     → POST /api/notificaciones
 *   - EpiController              → GET /api/epis
 *   - TipoDocumentoController    → GET /api/tipos-documento
 *   - EstadoDocumentoController  → GET /api/estados-documento
 *   - TipoObservacionController  → GET /api/tipos-observacion
 */
import React, { useEffect, useState, useMemo, useRef } from 'react';
import LayoutComandoDepartamental from '../../js/components/LayoutComandoDepartamental';
import EstadoBadge from '../../js/components/ui/EstadoBadge';
import Spinner from '../../js/components/ui/Spinner';
import Alert from '../../js/components/ui/Alert';
import Modal from '../../js/components/ui/Modal';
import { useConfirmar } from '../../js/components/ui/ConfirmDialog';
import { useAuth } from '../../js/context/AuthContext';
import api from '../../js/lib/api';
import { ChipEnVivo, useSyncGlobal } from '../../js/components/ui/ToastEnVivo';
import { Inbox, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';

const EJEMPLOS_OBSERVACION = [
    'Falta firma de la autoridad correspondiente.',
    'Fecha incorrecta o no coincide con la vigencia del trámite.',
    'No coincide el número de memorándum con los registros institucionales.',
    'PDF ilegible o con baja resolución de escaneo.',
    'Documento incompleto, faltan fojas anexas.',
    'Sello institucional borroso o ausente.',
    'Datos del oficial no coinciden con el escalafón activo.',
];

export default function RevisarDocumentos() {
    const { user } = useAuth();
    const [documentos, setDocumentos] = useState([]);
    const [epis, setEpis] = useState([]);
    const [tipos, setTipos] = useState([]);
    const [estados, setEstados] = useState([]);
    const [tiposObs, setTiposObs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [alertaAccion, setAlertaAccion] = useState(null);

    // Confirmación de acciones irreversibles (reemplaza a window.confirm).
    const { pedir, Confirmacion } = useConfirmar();

    // Pestaña activa en la cola de trabajo: 'pendientes' | 'observados' | 'reenviados' | 'aprobados'
    const [tabActiva, setTabActiva] = useState('pendientes');

    // Filtros
    const [busqueda, setBusqueda] = useState('');
    const [filtroEpi, setFiltroEpi] = useState('');
    const [filtroTipo, setFiltroTipo] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('');
    const [filtroFecha, setFiltroFecha] = useState('');

    // Modal de revisión
    const [docSeleccionado, setDocSeleccionado] = useState(null);
    const [detalleDoc, setDetalleDoc] = useState(null);
    const [cargandoDetalle, setCargandoDetalle] = useState(false);

    // Formulario de observación
    const [mostrarPanelObservar, setMostrarPanelObservar] = useState(false);
    const [idTipoObservacion, setIdTipoObservacion] = useState('');
    const [textoObservacion, setTextoObservacion] = useState('');
    const [procesandoAccion, setProcesandoAccion] = useState(false);

    // Cargar catálogos y documentos
    const cargarTodo = async () => {
        setLoading(true);
        try {
            const [docs, listaEpis, tDocs, eDocs, tObs] = await Promise.all([
                api.get('/documentos'),
                api.get('/epis'),
                api.get('/tipos-documento'),
                api.get('/estados-documento'),
                api.get('/tipos-observacion'),
            ]);
            setDocumentos(Array.isArray(docs) ? docs : []);
            setEpis(Array.isArray(listaEpis) ? listaEpis : []);
            setTipos(Array.isArray(tDocs) ? tDocs : []);
            setEstados(Array.isArray(eDocs) ? eDocs : []);
            setTiposObs(Array.isArray(tObs) ? tObs : []);
        } catch (err) {
            setError('No se pudieron cargar los datos del servidor.');
        } finally {
            setLoading(false);
        }
    };

    // Ref estable para el listener del modo en vivo
    const cargarTodoRef = useRef(cargarTodo);
    useEffect(() => {
        cargarTodoRef.current = cargarTodo;
    });

    useEffect(() => {
        cargarTodo();
    }, []);

    // ── MODO EN VIVO: si otra ventana sube/revisa un documento, refrescar ──
    const { conectado } = useSyncGlobal();
    useEffect(() => {
        const onSync = () => {
            if (typeof cargarTodoRef.current === 'function') cargarTodoRef.current();
        };
        window.addEventListener('ofbol:sync', onSync);
        return () => window.removeEventListener('ofbol:sync', onSync);
    }, []);

    // Abrir modal con detalle completo
    const abrirDetalle = async (doc) => {
        setDocSeleccionado(doc);
        setMostrarPanelObservar(false);
        setTextoObservacion('');
        setIdTipoObservacion('');
        setCargandoDetalle(true);
        try {
            const data = await api.get(`/documentos/${doc.id_documento}`);
            setDetalleDoc(data);
        } catch (_) {
            setDetalleDoc(doc);
        } finally {
            setCargandoDetalle(false);
        }
    };

    // Clasificación de la Cola de Trabajo en 4 pestañas
    const conteosTabs = useMemo(() => {
        const pendientes = documentos.filter(
            (d) =>
                d.estado?.nombre === 'Enviado por EPI' ||
                d.estado?.nombre === 'En revisión' ||
                d.estado?.nombre === 'Borrador'
        ).length;

        const observados = documentos.filter(
            (d) => d.estado?.nombre === 'Observado' || d.estado?.nombre === 'Devuelto'
        ).length;

        const reenviados = documentos.filter(
            (d) => d.estado?.nombre === 'Registrado' || d.versiones?.length > 1
        ).length;

        const aprobados = documentos.filter(
            (d) =>
                d.estado?.nombre === 'Aprobado' ||
                d.estado?.nombre === 'Remitido al Comando General'
        ).length;

        return { pendientes, observados, reenviados, aprobados };
    }, [documentos]);

    // Filtrar documentos según la pestaña y filtros aplicados
    const documentosFiltrados = useMemo(() => {
        let list = [...documentos];

        // Filtro por pestaña
        if (tabActiva === 'pendientes') {
            list = list.filter(
                (d) =>
                    d.estado?.nombre === 'Enviado por EPI' ||
                    d.estado?.nombre === 'En revisión' ||
                    d.estado?.nombre === 'Borrador'
            );
        } else if (tabActiva === 'observados') {
            list = list.filter(
                (d) => d.estado?.nombre === 'Observado' || d.estado?.nombre === 'Devuelto'
            );
        } else if (tabActiva === 'reenviados') {
            list = list.filter(
                (d) => d.estado?.nombre === 'Registrado' || d.versiones?.length > 1
            );
        } else if (tabActiva === 'aprobados') {
            list = list.filter(
                (d) =>
                    d.estado?.nombre === 'Aprobado' ||
                    d.estado?.nombre === 'Remitido al Comando General'
            );
        }

        // Filtro por EPI
        if (filtroEpi) {
            list = list.filter((d) => d.id_epi === parseInt(filtroEpi));
        }

        // Filtro por Tipo de Documento
        if (filtroTipo) {
            list = list.filter((d) => d.id_tipo === parseInt(filtroTipo));
        }

        // Filtro por Estado
        if (filtroEstado) {
            list = list.filter((d) => d.estado?.nombre === filtroEstado);
        }

        // Filtro por Fecha
        if (filtroFecha) {
            list = list.filter(
                (d) => d.fecha_subida && d.fecha_subida.startsWith(filtroFecha)
            );
        }

        // Búsqueda multifiltro (CI, Nombre, Grado, Código, Referencia, EPI)
        if (busqueda.trim()) {
            const q = busqueda.toLowerCase();
            list = list.filter(
                (d) =>
                    d.codigo_documento?.toLowerCase().includes(q) ||
                    d.referencia?.toLowerCase().includes(q) ||
                    d.oficial?.nombres?.toLowerCase().includes(q) ||
                    d.oficial?.apellidos?.toLowerCase().includes(q) ||
                    d.oficial?.ci?.includes(q) ||
                    d.oficial?.grado?.nombre?.toLowerCase().includes(q) ||
                    d.oficial?.grado?.abreviatura?.toLowerCase().includes(q) ||
                    d.epi?.nombre?.toLowerCase().includes(q) ||
                    d.usuario?.usuario?.toLowerCase().includes(q)
            );
        }

        return list.toSorted((a, b) => new Date(b.fecha_subida) - new Date(a.fecha_subida));
    }, [documentos, tabActiva, filtroEpi, filtroTipo, filtroEstado, filtroFecha, busqueda]);

    // ——————————————————————————————
    // ACCIÓN 1: APROBAR DOCUMENTO
    // ——————————————————————————————
    const handleAprobar = async () => {
        if (!docSeleccionado) return;
        const confirmado = await pedir({
            titulo: 'Aprobar y remitir',
            mensaje: `El documento ${docSeleccionado.codigo_documento} será aprobado y pasará automáticamente al Comando General.`,
            detalle: 'La EPI emisora recibirá la notificación.',
            tono: 'oliva',
            confirmarTexto: 'Aprobar y remitir',
        });
        if (!confirmado) return;

        setProcesandoAccion(true);
        try {
            // Buscar estado "Aprobado" o "Remitido al Comando General"
            const estadoAprobado = estados.find(
                (e) => e.nombre === 'Aprobado' || e.nombre === 'Remitido al Comando General'
            );
            const idEstadoNuevo = estadoAprobado ? estadoAprobado.id_estado : 5;

            // 1. Actualizar estado del documento
            await api.put(`/documentos/${docSeleccionado.id_documento}`, {
                ...docSeleccionado,
                estado_actual: idEstadoNuevo,
                usuario_cambio: user?.id_usuario ?? 1,
            });

            // 2. Registrar revisión en RevisionController
            await api.post('/revisiones', {
                id_documento: docSeleccionado.id_documento,
                usuario_revisor: user?.id_usuario ?? 1,
                nivel_revision: 'Comando Departamental La Paz',
                estado: 'Aprobado',
                observacion_libre: 'Documento revisado y aprobado conforme a normativa. Remitido al Comando General.',
                fecha: new Date().toISOString(),
            });


            // 4. Crear notificación al Secretario de la EPI
            if (docSeleccionado.id_usuario) {
                await api.post('/notificaciones', {
                    id_usuario: docSeleccionado.id_usuario,
                    id_documento: docSeleccionado.id_documento,
                    titulo: `Documento ${docSeleccionado.codigo_documento} APROBADO`,
                    mensaje: `El Comando Departamental ha aprobado el documento y lo ha remitido al Comando General.`,
                    leido: false,
                    fecha: new Date().toISOString(),
                }).catch(() => {});
            }

            setAlertaAccion({
                tipo: 'success',
                mensaje: `El documento ${docSeleccionado.codigo_documento} ha sido APROBADO y remitido al Comando General con éxito.`,
            });

            setDocSeleccionado(null);
            cargarTodo();
        } catch (err) {
            setAlertaAccion({
                tipo: 'error',
                mensaje: `Error al aprobar el documento: ${err.message}`,
            });
        } finally {
            setProcesandoAccion(false);
        }
    };

    // ——————————————————————————————
    // ACCIÓN 2: ENVIAR OBSERVACIÓN (DEVOLVER A EPI)
    // ——————————————————————————————
    const handleEnviarObservacion = async (e) => {
        e.preventDefault();
        if (!docSeleccionado) return;
        if (!textoObservacion.trim()) {
            setAlertaAccion({ tipo: 'warning', mensaje: 'Por favor escribe el detalle de la observación antes de devolver el trámite.' });
            return;
        }

        setProcesandoAccion(true);
        try {
            // Buscar estado "Observado" o "Devuelto"
            const estadoObservado = estados.find(
                (est) => est.nombre === 'Observado' || est.nombre === 'Devuelto'
            );
            const idEstadoNuevo = estadoObservado ? estadoObservado.id_estado : 4;

            // 1. Actualizar estado del documento a Observado / Devuelto
            await api.put(`/documentos/${docSeleccionado.id_documento}`, {
                ...docSeleccionado,
                estado_actual: idEstadoNuevo,
                usuario_cambio: user?.id_usuario ?? 1,
            });

            // 2. Registrar en RevisionController
            await api.post('/revisiones', {
                id_documento: docSeleccionado.id_documento,
                usuario_revisor: user?.id_usuario ?? 1,
                id_tipo_observacion: idTipoObservacion ? parseInt(idTipoObservacion) : null,
                nivel_revision: 'Comando Departamental La Paz',
                estado: 'Observado',
                observacion_libre: textoObservacion.trim(),
                fecha: new Date().toISOString(),
            });


            // 4. Crear notificación al Secretario de la EPI correspondiente
            if (docSeleccionado.id_usuario) {
                const epiNombre = docSeleccionado.epi?.nombre ?? 'su EPI';
                await api.post('/notificaciones', {
                    id_usuario: docSeleccionado.id_usuario,
                    id_documento: docSeleccionado.id_documento,
                    titulo: `Documento ${docSeleccionado.codigo_documento} OBSERVADO`,
                    mensaje: `Comando Departamental observó el documento de ${epiNombre}. Motivo: ${textoObservacion.trim()}`,
                    leido: false,
                    fecha: new Date().toISOString(),
                }).catch(() => {});
            }

            setAlertaAccion({
                tipo: 'warning',
                mensaje: `El documento ${docSeleccionado.codigo_documento} fue devuelto al Secretario de la ${docSeleccionado.epi?.nombre ?? 'EPI'} con las observaciones indicadas.`,
            });

            setDocSeleccionado(null);
            cargarTodo();
        } catch (err) {
            setAlertaAccion({
                tipo: 'error',
                mensaje: `Error al enviar observación: ${err.message}`,
            });
        } finally {
            setProcesandoAccion(false);
        }
    };

    const limpiarFiltros = () => {
        setBusqueda('');
        setFiltroEpi('');
        setFiltroTipo('');
        setFiltroEstado('');
        setFiltroFecha('');
    };

    const hayFiltros = busqueda || filtroEpi || filtroTipo || filtroEstado || filtroFecha;

    return (
        <LayoutComandoDepartamental>
            <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 ofbol-page-enter">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#fdf6e3] text-[#7f5a07] border border-[#f3e2b3]">
                                Instancia Departamental
                            </span>
                            <span className="text-xs text-slate-400">· Cola Oficial de Dictamen (9 EPIs)</span>
                        </div>
                        <div className="mb-2">
                            <ChipEnVivo conectado={conectado} />
                        </div>
                        <h1 className="ofbol-display heading-balance">
                            Cola de Trabajo y Bandeja de Revisión
                        </h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={cargarTodo}
                            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors self-start sm:self-auto"
                        >
                            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Actualizar
                        </button>
                    </div>
                </div>

                {alertaAccion && (
                    <Alert type={alertaAccion.tipo} onClose={() => setAlertaAccion(null)}>
                        {alertaAccion.mensaje}
                    </Alert>
                )}

                {error && <Alert type="error" onClose={() => setError(null)}>{error}</Alert>}

                {/* ── Pestañas de la cola de trabajo ──
                    La pestaña activa es un relleno institucional sólido: se
                    distingue por peso y color, no por una sombra suelta. */}
                <div className="ofbol-card p-1.5 flex flex-wrap gap-1.5" role="tablist" aria-label="Cola de trabajo">
                    {[
                        { clave: 'pendientes', etiqueta: 'Pendientes por revisar', icono: Inbox, conteo: conteosTabs.pendientes },
                        { clave: 'observados', etiqueta: 'Con observaciones', icono: AlertTriangle, conteo: conteosTabs.observados },
                        { clave: 'reenviados', etiqueta: 'Reenviados / corregidos', icono: RefreshCw, conteo: conteosTabs.reenviados },
                        { clave: 'aprobados', etiqueta: 'Aprobados (C. General)', icono: CheckCircle2, conteo: conteosTabs.aprobados },
                    ].map((t) => {
                        const activa = tabActiva === t.clave;
                        return (
                            <button
                                key={t.clave}
                                type="button"
                                role="tab"
                                aria-selected={activa}
                                onClick={() => setTabActiva(t.clave)}
                                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[11.5px] font-bold"
                                style={
                                    activa
                                        ? { background: '#3d4a2c', color: '#fbfaf6' }
                                        : { background: 'transparent', color: '#3f4849' }
                                }
                            >
                                <t.icono size={14} strokeWidth={2} aria-hidden="true" />
                                <span>{t.etiqueta}</span>
                                <span
                                    className="px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums"
                                    style={
                                        activa
                                            ? { background: 'rgba(255,255,255,0.16)', color: '#fbfaf6' }
                                            : { background: '#f2f0ea', color: '#5a615f' }
                                    }
                                >
                                    {t.conteo}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* BARRA DE BÚSQUEDA Y FILTROS */}
                <div className="bg-white rounded-[14px] border border-slate-100 p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        {/* Buscador global */}
                        <div className="relative lg:col-span-2">
                            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <input aria-label="Buscar por CI, Oficial, Memo, EPI, Tipo..."
                                type="text"
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                placeholder="Buscar por CI, Oficial, Memo, EPI, Tipo..."
                                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3d4a2c] placeholder-slate-400"
                            />
                        </div>

                        {/* Filtro por EPI (Las 9 de La Paz) */}
                        <select aria-label="Filtrar por EPI"
                            value={filtroEpi}
                            onChange={(e) => setFiltroEpi(e.target.value)}
                            className="text-xs border border-slate-200 rounded-xl py-2 px-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3d4a2c] bg-white"
                        >
                            <option value="">Todas las EPIs (9)</option>
                            {epis.map((e) => (
                                <option key={e.id_epi} value={e.id_epi}>{e.nombre}</option>
                            ))}
                        </select>

                        {/* Filtro por Tipo de Documento */}
                        <select aria-label="Filtrar por tipo"
                            value={filtroTipo}
                            onChange={(e) => setFiltroTipo(e.target.value)}
                            className="text-xs border border-slate-200 rounded-xl py-2 px-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3d4a2c] bg-white"
                        >
                            <option value="">Todos los Tipos</option>
                            {tipos.map((t) => (
                                <option key={t.id_tipo} value={t.id_tipo}>{t.nombre}</option>
                            ))}
                        </select>

                        {/* Filtro por Fecha */}
                        <input
                            type="date"
                            aria-label="Filtrar por fecha"
                            value={filtroFecha}
                            onChange={(e) => setFiltroFecha(e.target.value)}
                            className="text-xs border border-slate-200 rounded-xl py-2 px-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3d4a2c] bg-white"
                        />
                    </div>

                    {hayFiltros && (
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                            <span className="text-slate-500 font-medium">
                                Mostrando {documentosFiltrados.length} documentos coincidentes
                            </span>
                            <button
                                onClick={limpiarFiltros}
                                className="text-amber-700 font-semibold hover:underline"
                            >
                                Limpiar filtros
                            </button>
                        </div>
                    )}
                </div>

                {/* TABLA PRINCIPAL DE LA COLA DE TRABAJO */}
                <div className="bg-white rounded-[14px] border border-slate-100 overflow-hidden">
                    {loading ? (
                        <div className="flex justify-center py-20"><Spinner /></div>
                    ) : documentosFiltrados.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                            <svg className="w-12 h-12 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 4H7a2 2 0 01-2-2V6a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-sm font-semibold text-slate-600">No hay documentos en esta pestaña</p>
                            <p className="text-xs text-slate-400">Verifica los filtros o selecciona otra categoría de la cola.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                        <th className="px-5 py-3.5">Código / Memo</th>
                                        <th className="px-5 py-3.5">EPI Remitente</th>
                                        <th className="px-5 py-3.5">Oficial Involucrado</th>
                                        <th className="px-5 py-3.5">Secretario de Unidad</th>
                                        <th className="px-5 py-3.5">Tipo Trámite</th>
                                        <th className="px-5 py-3.5">Fecha Envío</th>
                                        <th className="px-5 py-3.5">Estado</th>
                                        <th className="px-5 py-3.5 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {documentosFiltrados.map((doc) => {
                                        const fecha = doc.fecha_subida
                                            ? new Date(doc.fecha_subida).toLocaleDateString('es-BO', {
                                                  day: '2-digit',
                                                  month: 'short',
                                                  year: 'numeric',
                                              })
                                            : '—';

                                        const nombreSecretario = doc.usuario?.usuario ?? 'Secretario';
                                        const epiSecretario = doc.usuario?.epi?.nombre ?? doc.epi?.nombre ?? 'EPI';

                                        return (
                                            <tr key={doc.id_documento} className="hover:bg-amber-50/20 transition-colors group">
                                                <td className="px-5 py-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                                                    {doc.codigo_documento}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 font-bold text-slate-800 border border-slate-200/60">
                                                        {doc.epi?.nombre ?? 'EPI La Paz'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <p className="font-bold text-slate-900 leading-tight">
                                                        {doc.oficial?.grado?.abreviatura ? `${doc.oficial.grado.abreviatura} ` : ''}
                                                        {doc.oficial?.nombres} {doc.oficial?.apellidos}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400">CI: {doc.oficial?.ci ?? '—'}</p>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <p className="font-semibold text-slate-800 leading-tight">{nombreSecretario}</p>
                                                    <p className="text-[10px] text-amber-700 font-bold">Secretario {epiSecretario}</p>
                                                </td>
                                                <td className="px-5 py-4 text-slate-600 max-w-[150px] truncate">
                                                    {doc.tipo_documento?.nombre ?? '—'}
                                                </td>
                                                <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{fecha}</td>
                                                <td className="px-5 py-4">
                                                    <EstadoBadge nombre={doc.estado?.nombre ?? 'Borrador'} />
                                                </td>
                                                <td className="px-5 py-4 text-right whitespace-nowrap">
                                                    <button
                                                        onClick={() => abrirDetalle(doc)}
                                                        className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white font-bold px-3.5 py-2 rounded-xl transition-colors shadow-sm text-xs"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                        Revisar Trámite
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

            {/* ——————————————————————————————
                MODAL DE REVISIÓN Y DICTAMEN
            —————————————————————————————— */}
            <Modal
                open={!!docSeleccionado}
                onClose={() => { setDocSeleccionado(null); setMostrarPanelObservar(false); }}
                title={`Revisión Departamental: ${docSeleccionado?.codigo_documento ?? ''}`}
                size="xl"
            >
                {docSeleccionado && (
                    <div className="space-y-6">
                        {/* Cabecera del Trámite */}
                        <div className="bg-slate-900 text-white p-5 rounded-[14px] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-base font-black text-amber-400">
                                        {docSeleccionado.codigo_documento}
                                    </span>
                                    <EstadoBadge nombre={docSeleccionado.estado?.nombre ?? 'Borrador'} />
                                </div>
                                <p className="text-xs text-slate-300 font-medium">
                                    {docSeleccionado.tipo_documento?.nombre ?? 'Memorándum'} &nbsp;·&nbsp;
                                    Ref: {docSeleccionado.referencia}
                                </p>
                            </div>

                            {/* Acciones directas de descarga */}
                            <a
                                href={`/storage/${docSeleccionado.ruta_pdf}`}
                                download
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white border border-white/20 transition-colors self-start md:self-auto"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M16 12l-4-4-4 4M12 8v8" />
                                </svg>
                                Descargar PDF Original
                            </a>
                        </div>

                        {/* Datos del Oficial y Secretario Remitente */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                            <div className="bg-slate-50 border border-slate-200/80 rounded-[14px] p-4">
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Oficial Involucrado</p>
                                <p className="font-bold text-slate-900 text-sm">
                                    {docSeleccionado.oficial?.grado?.abreviatura ? `${docSeleccionado.oficial.grado.abreviatura} ` : ''}
                                    {docSeleccionado.oficial?.nombres} {docSeleccionado.oficial?.apellidos}
                                </p>
                                <p className="text-slate-500 mt-0.5">CI: {docSeleccionado.oficial?.ci ?? '—'} · Escalafón: {docSeleccionado.oficial?.escalafon ?? '—'}</p>
                            </div>

                            <div className="bg-amber-50/50 border border-amber-200/80 rounded-[14px] p-4">
                                <p className="text-[10px] uppercase font-bold text-amber-700 tracking-wider mb-1">Remitente (Secretario EPI)</p>
                                <p className="font-bold text-slate-900 text-sm">
                                    {docSeleccionado.usuario?.usuario ?? 'Secretario'}
                                </p>
                                <p className="text-amber-800 font-semibold mt-0.5">
                                    Secretario {docSeleccionado.usuario?.epi?.nombre ?? docSeleccionado.epi?.nombre ?? 'EPI Asignada'}
                                </p>
                            </div>

                            <div className="bg-slate-50 border border-slate-200/80 rounded-[14px] p-4">
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Estado del Archivo</p>
                                <p className="text-xs font-bold text-emerald-800">
                                    Documento PDF Original Verificado
                                </p>
                                <p className="text-slate-400 text-[10px] mt-0.5">
                                    Fecha: {new Date(docSeleccionado.fecha_subida || Date.now()).toLocaleString('es-BO')}
                                </p>
                            </div>
                        </div>

                        {/* VISOR DE PDF ORIGINAL (Sin edición) */}
                        <div className="bg-slate-950 rounded-[14px] overflow-hidden border border-slate-800 p-1">
                            <div className="bg-slate-900 px-4 py-2 flex items-center justify-between text-xs text-slate-300">
                                <span className="font-mono flex items-center gap-1.5">
                                    <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    Visor de Documento Original (Solo Lectura)
                                </span>
                                <span className="text-[11px] text-slate-400 italic">No editable por normativa</span>
                            </div>
                            <iframe
                                src={`/storage/${docSeleccionado.ruta_pdf}`}
                                className="w-full h-80 bg-slate-800 rounded-xl"
                                title="Visor PDF Memorándum"
                            />
                        </div>

                        {/* HISTORIAL Y OBSERVACIONES PREVIAS */}
                        {detalleDoc?.revisiones && detalleDoc.revisiones.length > 0 && (
                            <div className="bg-slate-50 border border-slate-200/80 rounded-[14px] p-4 space-y-2">
                                <p className="text-xs font-bold text-slate-800">Historial de Revisiones Previas:</p>
                                <div className="space-y-2">
                                    {detalleDoc.revisiones.map((rev) => (
                                        <div key={rev.id_revision} className="p-3 bg-white rounded-xl border border-slate-200 text-xs">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-slate-900">{rev.nivel_revision} ({rev.estado})</span>
                                                <span className="text-slate-400">{new Date(rev.fecha).toLocaleString('es-BO')}</span>
                                            </div>
                                            {rev.observacion_libre && (
                                                <p className="text-slate-600 mt-1 italic">"{rev.observacion_libre}"</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* PANEL DE FORMULARIO DE OBSERVACIÓN */}
                        {mostrarPanelObservar && (
                            <form onSubmit={handleEnviarObservacion} className="bg-orange-50 border border-orange-200 rounded-[14px] p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                                        <h3 className="text-sm font-bold text-orange-900">
                                            Devolver Trámite con Observación a la EPI
                                        </h3>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setMostrarPanelObservar(false)}
                                        className="text-xs text-orange-700 hover:underline"
                                    >
                                        Cancelar
                                    </button>
                                </div>

                                {/* Selección de motivo predefinido */}
                                <div>
                                    <p className="block text-xs font-semibold text-orange-900 mb-1.5">
                                        Motivo de Observación Frecuente (Haz clic para insertar):
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {EJEMPLOS_OBSERVACION.map((ej) => (
                                            <button
                                                key={ej}
                                                type="button"
                                                onClick={() => setTextoObservacion((prev) => prev ? `${prev}\n- ${ej}` : ej)}
                                                className="text-[11px] bg-white border border-orange-200 text-orange-800 hover:bg-orange-100 px-2.5 py-1 rounded-lg transition-colors text-left"
                                            >
                                                + {ej}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Texto de observación libre */}
                                <div>
                                    <p className="block text-xs font-semibold text-orange-900 mb-1">
                                        Detalle Oficial de la Observación para el Secretario de la EPI <span className="text-red-500">*</span>:
                                    </p>
                                    <textarea aria-label="Escribe las instrucciones precisas para que la EPI corrija y reenvíe el documento..."
                                        rows={4}
                                        value={textoObservacion}
                                        onChange={(e) => setTextoObservacion(e.target.value)}
                                        placeholder="Escribe las instrucciones precisas para que la EPI corrija y reenvíe el documento..."
                                        className="w-full p-3 text-xs border border-orange-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#9a6f0a] bg-white placeholder-slate-400 resize-none"
                                        required
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setMostrarPanelObservar(false)}
                                        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-orange-100 transition-colors"
                                    >
                                        Cerrar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={procesandoAccion}
                                        className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-colors shadow-md"
                                    >
                                        {procesandoAccion ? (
                                            <><Spinner size="sm" /> Procesando devolución...</>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                                </svg>
                                                Enviar Observación y Devolver a EPI
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* ACCIONES PRINCIPALES DE DICTAMEN */}
                        {!mostrarPanelObservar && (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
                                <a
                                    href={`/storage/${docSeleccionado.ruta_pdf}`}
                                    download
                                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors w-full sm:w-auto justify-center"
                                >
                                    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M16 12l-4-4-4 4M12 8v8" />
                                    </svg>
                                    Descargar
                                </a>

                                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setMostrarPanelObservar(true)}
                                        disabled={procesandoAccion}
                                        className="inline-flex items-center justify-center gap-2 bg-orange-50 hover:bg-orange-100 border border-orange-300 text-orange-800 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors w-full sm:w-auto"
                                    >
                                        <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        Observar Documento
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleAprobar}
                                        disabled={procesandoAccion}
                                        className="inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-black px-6 py-2.5 rounded-xl transition-colors shadow-md shadow-emerald-900/20 w-full sm:w-auto"
                                    >
                                        {procesandoAccion ? (
                                            <><Spinner size="sm" /> Aprobando...</>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                                Aprobar y Remitir a C. General
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
            {Confirmacion}
        </LayoutComandoDepartamental>
    );
}
