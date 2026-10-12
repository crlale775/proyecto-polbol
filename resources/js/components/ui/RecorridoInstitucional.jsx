/**
 * RecorridoInstitucional.jsx — "Recorrido del trámite" compartido.
 *
 * Las dos pantallas de Trazabilidad (Comando Departamental y Comando General)
 * tenían ~1.700 líneas duplicadas que armaban a mano un stepper y una bitácora
 * con colores genéricos (azul/ámbar/esmeralda/rosa). Acá viven una sola vez,
 * con el sistema gráfico de OFBOL:
 *
 *   · FlujoDocumental  → las tres etapas institucionales y el retorno por
 *                        observación, con el nodo actual marcado.
 *   · LineaTiempo      → la cadena de custodia: quién, cuándo y con qué tono.
 *   · ChipsDato        → las cifras del trámite, en lugar de una ficha oscura
 *                        con párrafos.
 *
 * Datos: /documentos + /epis + /documentos/{id}/trazabilidad (una sola llamada
 * de detalle por documento seleccionado, como antes).
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
    Building2, ClipboardCheck, Landmark, Undo2, Download, Search,
    ArrowDownUp, MapPin, FileText, History, X,
} from 'lucide-react';
import EstadoBadge from './EstadoBadge';
import Spinner from './Spinner';
import Alert from './Alert';
import { FlujoDocumental, LineaTiempo, EstadoVacio, ChipsDato, Leyenda } from './Graficos';
import api from '../../lib/api';

/* Identidad por instancia: coincide con el acento de cada módulo
   (ámbar = departamental, teal = general) y con los colores de estado. */
const INSTANCIA = {
    epi: { label: 'Secretaría EPI', color: '#495456', tono: 'gris', badge: 'olive', icono: Building2 },
    departamental: { label: 'Cmd. Departamental', color: '#9a6f0a', tono: 'ambar', badge: 'amber', icono: ClipboardCheck },
    general: { label: 'Cmd. General', color: '#1a5c52', tono: 'teal', badge: 'teal', icono: Landmark },
    devolucion: { label: 'Devolución', color: '#8f2020', tono: 'crimson', badge: 'crimson', icono: Undo2 },
};

function detectarInstancia(item) {
    const rol = (item.usuario?.rol?.nombre || item.rol || '').toLowerCase();
    const nivel = (item.nivel_revision || '').toLowerCase();

    if (rol.includes('secretario') || rol.includes('epi') || rol.includes('unidad')) return 'epi';
    if (rol.includes('departamental') || rol.includes('comando d') || nivel.includes('departamental')) return 'departamental';
    if (rol.includes('general') || rol.includes('comando g') || nivel.includes('general')) return 'general';
    return 'epi';
}

const fechaHora = (f, conSegundos = false) =>
    f
        ? new Date(f).toLocaleString('es-BO', {
              day: '2-digit', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
              ...(conSegundos ? { second: '2-digit' } : {}),
          })
        : '—';

const fechaCorta = (f) => (f ? new Date(f).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function RecorridoInstitucional({
    Layout,
    titulo,
    detalle,
    acento = '#3d4a2c',
}) {
    const [documentos, setDocumentos] = useState([]);
    const [epis, setEpis] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [docSeleccionadoId, setDocSeleccionadoId] = useState(null);
    const [expediente, setExpediente] = useState(null);
    const [cargandoDetalle, setCargandoDetalle] = useState(false);

    const [busqueda, setBusqueda] = useState('');
    const [filtroEpi, setFiltroEpi] = useState('todas');
    const [filtroEstadoDoc, setFiltroEstadoDoc] = useState('todos');

    const [filtroTexto, setFiltroTexto] = useState('');
    const [filtroInstancia, setFiltroInstancia] = useState('todas');
    const [filtroTipo, setFiltroTipo] = useState('todos');
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');
    const [orden, setOrden] = useState('asc');

    /* ── Carga ─────────────────────────────────────────────── */

    useEffect(() => {
        let vivo = true;
        (async () => {
            try {
                setLoading(true);
                const [docsRes, episRes] = await Promise.all([api.get('/documentos'), api.get('/epis')]);
                if (!vivo) return;
                const lista = Array.isArray(docsRes) ? docsRes : [];
                setDocumentos(lista);
                if (lista.length > 0) setDocSeleccionadoId(lista[0].id_documento);
                setEpis(Array.isArray(episRes) ? episRes : []);
            } catch {
                if (vivo) setError('No se pudieron cargar los trámites. Verificá la conexión con el servidor.');
            } finally {
                if (vivo) setLoading(false);
            }
        })();
        return () => { vivo = false; };
    }, []);

    useEffect(() => {
        if (!docSeleccionadoId) return undefined;
        let vivo = true;
        (async () => {
            try {
                setCargandoDetalle(true);
                const res = await api.get(`/documentos/${docSeleccionadoId}/trazabilidad`);
                if (vivo) setExpediente(res);
            } catch {
                if (vivo) setError('No se pudo cargar el recorrido de ese trámite.');
            } finally {
                if (vivo) setCargandoDetalle(false);
            }
        })();
        return () => { vivo = false; };
    }, [docSeleccionadoId]);

    /* ── Filtros del selector de documentos ────────────────── */

    const docsFiltrados = useMemo(() => {
        return documentos
            .filter((d) => {
                const q = busqueda.toLowerCase();
                const coincideBusqueda =
                    !q ||
                    (d.codigo_documento || '').toLowerCase().includes(q) ||
                    `${d.oficial?.nombres || ''} ${d.oficial?.apellidos || ''}`.toLowerCase().includes(q) ||
                    (d.oficial?.ci || '').includes(q) ||
                    (d.tipo_documento?.nombre || '').toLowerCase().includes(q) ||
                    (d.referencia || '').toLowerCase().includes(q);

                const coincideEpi = filtroEpi === 'todas' || String(d.id_epi) === String(filtroEpi);
                const st = (d.estado?.nombre || '').toLowerCase();
                const coincideEstado =
                    filtroEstadoDoc === 'todos' ||
                    (filtroEstadoDoc === 'en_curso' && !st.includes('registrado') && !st.includes('observ')) ||
                    (filtroEstadoDoc === 'observado' && st.includes('observ')) ||
                    (filtroEstadoDoc === 'registrado' && st.includes('registrado'));

                return coincideBusqueda && coincideEpi && coincideEstado;
            })
            .toSorted((a, b) => new Date(b.fecha_subida) - new Date(a.fecha_subida));
    }, [documentos, busqueda, filtroEpi, filtroEstadoDoc]);

    const docActual = expediente?.documento;
    const historial = expediente?.historial ?? [];
    const revisiones = expediente?.revisiones ?? [];

    /* ── Cadena de custodia ────────────────────────────────── */

    const eventos = useMemo(() => {
        const acumulado = [];

        historial.forEach((h, idx) => {
            const estadoNuevo = h.estado_nuevo?.nombre || 'Actualización de estado';
            const estadoAnterior = h.estado_anterior?.nombre || null;
            const esDevolucion = /observ|devuelto/i.test(estadoNuevo);
            const instancia = esDevolucion ? 'devolucion' : detectarInstancia(h);

            let direccion = 'Registro en el sistema';
            if (/Enviado por EPI|Remitido al Comando/i.test(estadoNuevo)) direccion = 'Remitido al Comando Departamental';
            else if (/Aprobado|Remitido al Comando General/i.test(estadoNuevo)) direccion = 'Remitido al Comando General';
            else if (/Registrado/i.test(estadoNuevo)) direccion = 'Validado y registrado formalmente';
            else if (esDevolucion) direccion = 'Devuelto a la Secretaría EPI para subsanación';

            acumulado.push({
                id: `hist-${h.id_historial || idx}`,
                tipo: 'estado',
                tipoEtiqueta: esDevolucion ? 'Devolución de estado' : 'Cambio de estado',
                fecha: h.fecha ? new Date(h.fecha) : new Date(),
                usuario: h.usuario?.usuario || 'Sistema',
                rol: h.usuario?.rol?.nombre || 'Operador',
                epi: h.usuario?.epi?.nombre || docActual?.epi?.nombre || 'La Paz',
                estadoAnterior,
                estadoNuevo,
                titulo: estadoAnterior ? `${estadoAnterior} → ${estadoNuevo}` : `Ingreso inicial · ${estadoNuevo}`,
                descripcion: null,
                esDevolucion,
                instancia,
                direccion,
            });
        });

        revisiones.forEach((r, idx) => {
            const esDevolucion = /observ/i.test(r.estado || '');
            const nivel = r.nivel_revision || 'Revisión normativa';
            const instancia = esDevolucion ? 'devolucion' : detectarInstancia({ ...r, rol: nivel });

            let direccion = `Dictamen emitido por ${nivel}`;
            if (esDevolucion) direccion = `Observación registrada por ${nivel} — requiere subsanación`;
            else if (/aprob/i.test(r.estado || '')) direccion = `Aprobado conforme a norma por ${nivel}`;

            acumulado.push({
                id: `rev-${r.id_revision || idx}`,
                tipo: 'revision',
                tipoEtiqueta: esDevolucion ? 'Observación formal' : 'Dictamen de revisión',
                fecha: r.fecha ? new Date(r.fecha) : new Date(),
                usuario: r.revisor?.usuario || `Revisor #${r.usuario_revisor ?? '—'}`,
                rol: nivel,
                epi: r.revisor?.epi?.nombre || 'Comando Departamental',
                estadoAnterior: null,
                estadoNuevo: r.estado,
                titulo: `${nivel} · ${r.estado ?? 'Dictamen'}`,
                descripcion: r.observacion_libre || (r.tipo_observacion?.nombre ? `Tipo: ${r.tipo_observacion.nombre}` : null),
                esDevolucion,
                instancia,
                direccion,
            });
        });

        return acumulado.toSorted((a, b) => (orden === 'asc' ? a.fecha - b.fecha : b.fecha - a.fecha));
    }, [historial, revisiones, docActual, orden]);

    const eventosFiltrados = useMemo(() => {
        const q = filtroTexto.toLowerCase();
        const desde = fechaDesde ? new Date(`${fechaDesde}T00:00:00`) : null;
        const hasta = fechaHasta ? new Date(`${fechaHasta}T23:59:59`) : null;

        return eventos.filter((ev) => {
            const coincideTexto =
                !q ||
                ev.titulo.toLowerCase().includes(q) ||
                ev.usuario.toLowerCase().includes(q) ||
                ev.rol.toLowerCase().includes(q) ||
                ev.direccion.toLowerCase().includes(q) ||
                (ev.descripcion && ev.descripcion.toLowerCase().includes(q));

            const coincideInstancia =
                filtroInstancia === 'todas' ||
                (filtroInstancia === 'devolucion' && ev.esDevolucion) ||
                ev.instancia === filtroInstancia;

            const coincideTipo =
                filtroTipo === 'todos' ||
                (filtroTipo === 'devoluciones' && ev.esDevolucion) ||
                (filtroTipo === 'revisiones' && ev.tipo === 'revision' && !ev.esDevolucion) ||
                (filtroTipo === 'estados' && ev.tipo === 'estado' && !ev.esDevolucion);

            const coincideFecha = (!desde || ev.fecha >= desde) && (!hasta || ev.fecha <= hasta);
            return coincideTexto && coincideInstancia && coincideTipo && coincideFecha;
        });
    }, [eventos, filtroTexto, filtroInstancia, filtroTipo, fechaDesde, fechaHasta]);

    const hayFiltros =
        Boolean(filtroTexto) || filtroInstancia !== 'todas' || filtroTipo !== 'todos' || Boolean(fechaDesde) || Boolean(fechaHasta);

    const limpiarFiltros = () => {
        setFiltroTexto('');
        setFiltroInstancia('todas');
        setFiltroTipo('todos');
        setFechaDesde('');
        setFechaHasta('');
    };

    /* ── Estado del trámite y etapas ───────────────────────── */

    const estadoNombre = docActual?.estado?.nombre || '';
    const esRegistrado = estadoNombre === 'Registrado';
    const esObservado = /observ/i.test(estadoNombre);
    const totalDevoluciones = eventos.filter((e) => e.esDevolucion).length;

    const etapaActual = useMemo(() => {
        if (esRegistrado) return 3;
        if (/Remitido al Comando General|Aprobado/i.test(estadoNombre)) return 3;
        if (/Revisión|Enviado por EPI|Recibido/i.test(estadoNombre)) return 2;
        return 1;
    }, [estadoNombre, esRegistrado]);

    /*
     * Las etapas se derivan de los EVENTOS REALES, no solo del nombre del
     * estado actual: un trámite devuelto tiene la etapa departamental cumplida
     * aunque el estado diga "Observado". El nodo activo es dónde está hoy.
     */
    const etapas = useMemo(() => {
        if (!docActual) return [];
        const huboEn = (clave) => eventos.some((e) => e.instancia === clave);

        const marcar = (numero, cumplida) =>
            etapaActual === numero ? 'activa' : cumplida ? 'completa' : 'pendiente';

        return [
            {
                clave: 'epi',
                label: 'Secretaría EPI',
                sub: docActual.epi?.nombre || 'Origen',
                icono: Building2,
                estado: marcar(1, huboEn('epi')),
            },
            {
                clave: 'departamental',
                label: 'Cmd. Departamental',
                sub: esObservado ? 'Devuelto a la EPI' : 'Fiscalización normativa',
                icono: ClipboardCheck,
                estado: marcar(2, huboEn('departamental') || huboEn('devolucion')),
            },
            {
                clave: 'general',
                label: 'Cmd. General',
                sub: esRegistrado ? 'Registrado en escalafón' : 'Pendiente de registro',
                icono: Landmark,
                estado: marcar(3, huboEn('general')),
            },
        ];
    }, [docActual, etapaActual, esObservado, esRegistrado, eventos]);

    /* Cuántos eventos registró cada instancia: la leyenda muestra datos reales. */
    const leyenda = useMemo(
        () =>
            Object.entries(INSTANCIA)
                .map(([clave, cfg]) => ({
                    label: cfg.label,
                    color: cfg.color,
                    total: eventos.filter((e) => e.instancia === clave).length,
                }))
                .filter((d) => d.total > 0),
        [eventos],
    );

    const eventosLinea = useMemo(
        () =>
            eventosFiltrados.map((ev) => {
                const cfg = INSTANCIA[ev.instancia] ?? INSTANCIA.epi;
                return {
                    id: ev.id,
                    titulo: ev.titulo,
                    fecha: fechaHora(ev.fecha, true),
                    detalle: ev.descripcion ? `“${ev.descripcion}”` : ev.direccion,
                    icono: cfg.icono,
                    tono: ev.esDevolucion ? 'crimson' : cfg.tono,
                    meta: [
                        { texto: ev.tipoEtiqueta, tono: ev.esDevolucion ? 'crimson' : cfg.badge },
                        { texto: `${ev.usuario} · ${ev.rol}`, tono: 'olive' },
                        { texto: ev.epi, tono: 'olive' },
                    ],
                };
            }),
        [eventosFiltrados],
    );

    /* ── Render ────────────────────────────────────────────── */

    return (
        <Layout>
            <div className="p-4 sm:p-6 lg:p-8 max-w-full mx-auto space-y-5 ofbol-page-enter">

                {/* ── Encabezado ── */}
                <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="ofbol-display heading-balance">{titulo}</h1>
                        <p className="ofbol-nota mt-2">{detalle}</p>
                    </div>

                    {leyenda.length > 0 && (
                        <div className="ofbol-card p-4 shrink-0">
                            <p className="ofbol-etiqueta mb-2.5">Eventos por instancia</p>
                            <Leyenda datos={leyenda} />
                        </div>
                    )}
                </header>

                {error && <Alert type="warning" onClose={() => setError(null)}>{error}</Alert>}

                {loading ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-24">
                        <Spinner />
                        <p className="text-xs font-semibold text-[#5a615f]">Cargando trámites institucionales…</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

                        {/* ══ Selector de trámites ══ */}
                        <div className="lg:col-span-4 xl:col-span-3">
                            <div className="ofbol-card flex flex-col overflow-hidden lg:sticky lg:top-4 lg:h-[calc(100vh-190px)]">
                                <div className="p-4 space-y-3 shrink-0" style={{ borderBottom: '1px solid #e3dfd6' }}>
                                    <div className="flex items-center justify-between gap-2">
                                        <h2 className="ofbol-etiqueta flex items-center gap-1.5">
                                            <FileText size={12} strokeWidth={2.2} aria-hidden="true" />
                                            Trámites
                                        </h2>
                                        <span className="text-[10px] font-bold text-[#969b98] tabular-nums">
                                            {docsFiltrados.length} / {documentos.length}
                                        </span>
                                    </div>

                                    <div className="relative">
                                        <Search
                                            size={14}
                                            strokeWidth={2}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                                            style={{ color: '#969b98' }}
                                            aria-hidden="true"
                                        />
                                        <label htmlFor="recorrido-busqueda" className="sr-only">Buscar por memo, oficial o CI</label>
                                        <input
                                            id="recorrido-busqueda"
                                            name="busqueda"
                                            type="search"
                                            value={busqueda}
                                            onChange={(e) => setBusqueda(e.target.value)}
                                            placeholder="Memo, oficial o CI…"
                                            className="ofbol-input w-full pl-9"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="recorrido-epi" className="sr-only">Filtrar por EPI de origen</label>
                                        <select
                                            id="recorrido-epi"
                                            name="epi"
                                            value={filtroEpi}
                                            onChange={(e) => setFiltroEpi(e.target.value)}
                                            className="ofbol-input w-full"
                                        >
                                            <option value="todas">Todas las EPIs de origen</option>
                                            {epis.map((e) => (
                                                <option key={e.id_epi} value={e.id_epi}>{e.nombre}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex gap-1" role="group" aria-label="Filtrar por estado del trámite">
                                        {[
                                            { id: 'todos', label: 'Todos' },
                                            { id: 'en_curso', label: 'En curso' },
                                            { id: 'observado', label: 'Observados' },
                                            { id: 'registrado', label: 'Cerrados' },
                                        ].map((t) => {
                                            const activo = filtroEstadoDoc === t.id;
                                            return (
                                                <button
                                                    key={t.id}
                                                    type="button"
                                                    onClick={() => setFiltroEstadoDoc(t.id)}
                                                    aria-pressed={activo}
                                                    className="flex-1 py-1.5 text-[10px] font-bold rounded-lg"
                                                    style={
                                                        activo
                                                            ? { background: acento, color: '#fbfaf6' }
                                                            : { background: '#f2f0ea', color: '#4e5553' }
                                                    }
                                                >
                                                    {t.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="ofbol-scroll flex-1 overflow-y-auto p-2 space-y-1">
                                    {docsFiltrados.length === 0 ? (
                                        <EstadoVacio compacto icono={FileText} titulo="Sin trámites" nota="Ajustá la búsqueda o los filtros." />
                                    ) : (
                                        docsFiltrados.map((d) => {
                                            const seleccionado = docSeleccionadoId === d.id_documento;
                                            return (
                                                <button
                                                    key={d.id_documento}
                                                    type="button"
                                                    onClick={() => setDocSeleccionadoId(d.id_documento)}
                                                    aria-pressed={seleccionado}
                                                    className="w-full text-left p-3 rounded-xl"
                                                    style={
                                                        seleccionado
                                                            ? { background: '#eef0e8', border: `1px solid ${acento}` }
                                                            : { background: 'transparent', border: '1px solid transparent' }
                                                    }
                                                >
                                                    <div className="flex items-center justify-between gap-2 mb-1">
                                                        <span className="font-mono text-[11.5px] font-black text-[#14181a] truncate">
                                                            {d.codigo_documento}
                                                        </span>
                                                        <EstadoBadge nombre={d.estado?.nombre ?? 'Borrador'} />
                                                    </div>

                                                    <p className="text-[11.5px] font-bold text-[#3f4849] truncate leading-tight">
                                                        {d.oficial?.grado?.abreviatura && <span className="text-[#3d4a2c]">{d.oficial.grado.abreviatura} </span>}
                                                        {d.oficial?.nombres} {d.oficial?.apellidos}
                                                    </p>

                                                    <p className="text-[10.5px] text-[#5a615f] truncate mt-0.5">{d.referencia}</p>

                                                    <div className="flex items-center justify-between gap-2 text-[10px] text-[#969b98] mt-2 pt-1.5" style={{ borderTop: '1px solid #eceae4' }}>
                                                        <span className="font-semibold text-[#5a615f] truncate flex items-center gap-1">
                                                            <MapPin size={9} strokeWidth={2.2} aria-hidden="true" />
                                                            {d.epi?.nombre}
                                                        </span>
                                                        <span className="tabular-nums shrink-0">{fechaCorta(d.fecha_subida)}</span>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ══ Recorrido del trámite seleccionado ══ */}
                        <div className="lg:col-span-8 xl:col-span-9 space-y-5 min-w-0">
                            {cargandoDetalle ? (
                                <div className="ofbol-card flex flex-col items-center justify-center gap-3 py-24">
                                    <Spinner />
                                    <p className="text-xs font-semibold text-[#5a615f]">Cargando el recorrido completo…</p>
                                </div>
                            ) : !docActual ? (
                                <div className="ofbol-card">
                                    <EstadoVacio
                                        icono={History}
                                        titulo="Seleccioná un trámite"
                                        nota="Elegí un memorándum del listado para ver su cadena de custodia: quién lo emitió, quién lo visó y en qué momento."
                                    />
                                </div>
                            ) : (
                                <>
                                    {/* ── 1. Ficha del trámite ── */}
                                    <section className="ofbol-card p-5">
                                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-mono text-[15px] font-black tracking-tight text-[#14181a]">
                                                        {docActual.codigo_documento}
                                                    </span>
                                                    <EstadoBadge nombre={docActual.estado?.nombre ?? 'En trámite'} />
                                                    {totalDevoluciones > 0 && (
                                                        <span className="ofbol-badge ofbol-badge--crimson">
                                                            {totalDevoluciones} devolución{totalDevoluciones === 1 ? '' : 'es'}
                                                        </span>
                                                    )}
                                                </div>

                                                <h2 className="text-[14px] font-bold text-[#14181a] leading-snug mt-2">
                                                    {docActual.referencia || 'Sin referencia registrada'}
                                                </h2>

                                                <p className="text-[11.5px] text-[#5a615f] mt-1">
                                                    {docActual.tipo_documento?.nombre ?? 'Memorándum'}
                                                    <span className="text-[#cfc9bc]"> · </span>
                                                    {docActual.epi?.nombre}
                                                </p>
                                            </div>

                                            {docActual.ruta_pdf && (
                                                <a
                                                    href={`/storage/${docActual.ruta_pdf}`}
                                                    download
                                                    className="ofbol-btn-ghost shrink-0 self-start"
                                                >
                                                    <Download size={13} strokeWidth={2.2} aria-hidden="true" />
                                                    PDF intacto
                                                </a>
                                            )}
                                        </div>

                                        <div className="mt-4">
                                            <ChipsDato
                                                datos={[
                                                    { valor: eventos.length, etiqueta: 'Eventos' },
                                                    {
                                                        valor: `${docActual.oficial?.nombres ?? ''} ${docActual.oficial?.apellidos ?? ''}`.trim() || '—',
                                                        etiqueta: 'Oficial destinatario',
                                                    },
                                                    { valor: docActual.usuario?.usuario ?? '—', etiqueta: 'Secretario remitente' },
                                                    { valor: fechaCorta(docActual.fecha_subida), etiqueta: 'Emisión' },
                                                ]}
                                            />
                                        </div>

                                        {docActual.hash && (
                                            <div className="mt-4 pt-4" style={{ borderTop: '1px solid #e3dfd6' }}>
                                                <p className="ofbol-etiqueta">Hash SHA-256 · documento inalterado</p>
                                                <p className="font-mono text-[10.5px] font-bold text-[#3d4a2c] truncate mt-1">
                                                    {docActual.hash}
                                                </p>
                                            </div>
                                        )}
                                    </section>

                                    {/* ── 2. Etapas institucionales ── */}
                                    <section className="ofbol-card p-5 sm:p-6">
                                        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
                                            <h2 className="ofbol-titulo-seccion">Etapas institucionales</h2>
                                            <span className="ofbol-etiqueta">
                                                {esRegistrado ? 'Recorrido completado' : 'En supervisión'}
                                            </span>
                                        </div>

                                        <FlujoDocumental
                                            etapas={etapas}
                                            retorno={
                                                totalDevoluciones > 0
                                                    ? `${totalDevoluciones} ${totalDevoluciones === 1 ? 'retorno' : 'retornos'} a la EPI para subsanación. El detalle del motivo está en la bitácora.`
                                                    : null
                                            }
                                            ariaLabel={`Etapas del trámite: ${etapas.map((e) => `${e.label} ${e.estado}`).join(', ')}`}
                                        />
                                    </section>

                                    {/* ── 3. Cadena de custodia ── */}
                                    <section className="ofbol-card overflow-hidden">
                                        <div className="p-4 space-y-3" style={{ borderBottom: '1px solid #e3dfd6' }}>
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                <h2 className="ofbol-titulo-seccion">
                                                    Cadena de custodia
                                                    <span className="ml-2 font-bold text-[#969b98] normal-case tracking-normal tabular-nums">
                                                        {eventosFiltrados.length} de {eventos.length} eventos
                                                    </span>
                                                </h2>

                                                <button
                                                    type="button"
                                                    onClick={() => setOrden(orden === 'asc' ? 'desc' : 'asc')}
                                                    className="ofbol-btn-ghost self-start"
                                                    aria-label={`Ordenar ${orden === 'asc' ? 'del más reciente al más antiguo' : 'del más antiguo al más reciente'}`}
                                                >
                                                    <ArrowDownUp size={13} strokeWidth={2.2} aria-hidden="true" />
                                                    {orden === 'asc' ? 'Cronológico' : 'Recientes primero'}
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                                                <div className="relative">
                                                    <Search
                                                        size={14}
                                                        strokeWidth={2}
                                                        className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                                                        style={{ color: '#969b98' }}
                                                        aria-hidden="true"
                                                    />
                                                    <label htmlFor="custodia-texto" className="sr-only">Filtrar por operador o acción</label>
                                                    <input
                                                        id="custodia-texto"
                                                        name="texto"
                                                        type="search"
                                                        value={filtroTexto}
                                                        onChange={(e) => setFiltroTexto(e.target.value)}
                                                        placeholder="Operador o acción…"
                                                        className="ofbol-input w-full pl-9"
                                                    />
                                                </div>

                                                <div>
                                                    <label htmlFor="custodia-instancia" className="sr-only">Filtrar por instancia</label>
                                                    <select
                                                        id="custodia-instancia"
                                                        name="instancia"
                                                        value={filtroInstancia}
                                                        onChange={(e) => setFiltroInstancia(e.target.value)}
                                                        className="ofbol-input w-full"
                                                    >
                                                        <option value="todas">Todas las instancias</option>
                                                        <option value="epi">Solo Secretaría EPI</option>
                                                        <option value="departamental">Solo Cmd. Departamental</option>
                                                        <option value="general">Solo Cmd. General</option>
                                                        <option value="devolucion">Solo devoluciones</option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <label htmlFor="custodia-tipo" className="sr-only">Filtrar por tipo de evento</label>
                                                    <select
                                                        id="custodia-tipo"
                                                        name="tipo"
                                                        value={filtroTipo}
                                                        onChange={(e) => setFiltroTipo(e.target.value)}
                                                        className="ofbol-input w-full"
                                                    >
                                                        <option value="todos">Todos los eventos</option>
                                                        <option value="estados">Cambios de estado</option>
                                                        <option value="revisiones">Dictámenes</option>
                                                        <option value="devoluciones">Devoluciones</option>
                                                    </select>
                                                </div>

                                                <div className="flex gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <label htmlFor="custodia-desde" className="sr-only">Fecha desde</label>
                                                        <input
                                                            id="custodia-desde"
                                                            name="desde"
                                                            type="date"
                                                            value={fechaDesde}
                                                            onChange={(e) => setFechaDesde(e.target.value)}
                                                            className="ofbol-input w-full"
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <label htmlFor="custodia-hasta" className="sr-only">Fecha hasta</label>
                                                        <input
                                                            id="custodia-hasta"
                                                            name="hasta"
                                                            type="date"
                                                            value={fechaHasta}
                                                            onChange={(e) => setFechaHasta(e.target.value)}
                                                            className="ofbol-input w-full"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {hayFiltros && (
                                                <div className="flex justify-end">
                                                    <button type="button" onClick={limpiarFiltros} className="ofbol-btn-ghost">
                                                        <X size={13} strokeWidth={2.4} aria-hidden="true" />
                                                        Quitar filtros
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="ofbol-scroll p-5 max-h-[62vh] overflow-y-auto">
                                            {eventosFiltrados.length === 0 ? (
                                                <EstadoVacio
                                                    compacto
                                                    icono={History}
                                                    titulo="Sin eventos coincidentes"
                                                    nota="Probá ampliar el rango de fechas o quitar el filtro de instancia."
                                                />
                                            ) : (
                                                <LineaTiempo eventos={eventosLinea} numerar={false} ariaLabel="Cadena de custodia del trámite" />
                                            )}
                                        </div>
                                    </section>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}
