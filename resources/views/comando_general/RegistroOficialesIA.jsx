/**
 * RegistroOficialesIA.jsx — Panel de Registro de Oficiales y Verificación IA
 * Comando General de la Policía Boliviana
 *
 * Funciones:
 *  - Generar links de registro (el emisor elige el ROL y la EPI). El link se
 *    envía al oficial (WhatsApp) y abre el form público /registro-oficial/:token.
 *  - Listar solicitudes recibidas con su estado IA (firma, sello, nombres).
 *  - Ejecutar la verificación con la IA local (detecta si el nombre del
 *    registro NO coincide con el memo de designación → advertencia).
 *  - Aprobar (activa la cuenta) o rechazar la solicitud.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { IdCard } from 'lucide-react';
import LayoutComandoGeneral from '../../js/components/LayoutComandoGeneral';
import Spinner from '../../js/components/ui/Spinner';
import Alert from '../../js/components/ui/Alert';
import Modal from '../../js/components/ui/Modal';
import { useConfirmar } from '../../js/components/ui/ConfirmDialog';
import { useAuth } from '../../js/context/AuthContext';
import api from '../../js/lib/api';
import { ChipEnVivo, useSyncGlobal } from '../../js/components/ui/ToastEnVivo';

const URL_BASE = window.location.origin;

function fmtFecha(f) {
    if (!f) return '—';
    const d = new Date(f);
    return isNaN(d) ? '—' : d.toLocaleString('es-BO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const BADGES_ESTADO = {
    recibida:   { label: 'Recibida',   cls: 'bg-blue-50 text-blue-800 border-blue-200' },
    verificada: { label: 'Verificada', cls: 'bg-teal-50 text-teal-800 border-teal-200' },
    aprobada:   { label: 'Aprobada',   cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    rechazada:  { label: 'Rechazada',  cls: 'bg-red-50 text-red-800 border-red-200' },
};

const BADGES_IA = {
    pendiente:  { label: 'IA pendiente', cls: 'bg-slate-100 text-slate-600' },
    en_cola:    { label: 'En cola (automático)', cls: 'bg-amber-50 text-amber-700' },
    verificando:{ label: 'Verificando con IA…', cls: 'bg-blue-50 text-blue-700' },
    procesada:  { label: 'IA procesada', cls: 'bg-emerald-50 text-emerald-700' },
    error:      { label: 'IA error',     cls: 'bg-red-50 text-red-700' },
};

export default function RegistroOficialesIA() {
    const { user } = useAuth();
    const [solicitudes, setSolicitudes] = useState([]);
    const [links, setLinks] = useState([]);
    const [roles, setRoles] = useState([]);
    const [epis, setEpis] = useState([]);
    const [loading, setLoading] = useState(true);
    const [mensaje, setMensaje] = useState(null);
    const [procesando, setProcesando] = useState(false);

    // Generación de link
    const [modalLink, setModalLink] = useState(false);
    const [formLink, setFormLink] = useState({ id_rol: '1', id_epi: '1' });
    const [linkGenerado, setLinkGenerado] = useState(null);
    const [celularWa, setCelularWa] = useState('');

    // Detalle / acciones
    const [detalle, setDetalle] = useState(null);
    const [cargandoDetalle, setCargandoDetalle] = useState(false);
    const [modalRechazo, setModalRechazo] = useState(false);
    const [motivoRechazo, setMotivoRechazo] = useState('');

    // Confirmación de acciones irreversibles (reemplaza a window.confirm).
    const { pedir, Confirmacion } = useConfirmar();

    const cargarTodo = async () => {
        setLoading(true);
        try {
            const [sol, lnk, rls, eps] = await Promise.all([
                api.get('/solicitudes-registro'),
                api.get('/registro-links'),
                api.get('/roles'),
                api.get('/epis'),
            ]);
            setSolicitudes(Array.isArray(sol) ? sol : []);
            setLinks(Array.isArray(lnk) ? lnk : []);
            setRoles(Array.isArray(rls) ? rls : []);
            setEpis(Array.isArray(eps) ? eps : []);
        } catch (err) {
            setMensaje({ tipo: 'error', texto: 'Error al cargar los datos del panel.' });
        } finally {
            setLoading(false);
        }
    };

    // Ref estable para que el listener del modo en vivo siempre llame a la versión actual
    const cargarTodoRef = useRef(cargarTodo);
    useEffect(() => {
        cargarTodoRef.current = cargarTodo;
    });

    useEffect(() => {
        cargarTodo();
    }, []);

    // ── MODO EN VIVO: nuevas solicitudes de registro o IA terminada → refrescar ──
    const { conectado } = useSyncGlobal();
    useEffect(() => {
        const onSync = () => {
            if (typeof cargarTodoRef.current === 'function') cargarTodoRef.current();
        };
        window.addEventListener('ofbol:sync', onSync);
        return () => window.removeEventListener('ofbol:sync', onSync);
    }, []);

    const rolEsSecretario = () => {
        const r = roles.find((x) => String(x.id_rol) === String(formLink.id_rol));
        return (r?.nombre || '').toLowerCase().includes('secretario');
    };

    // ── Generar link de registro ──
    const generarLink = async (e) => {
        e.preventDefault();
        setProcesando(true);
        setLinkGenerado(null);
        try {
            const res = await api.post('/registro-links', {
                id_rol: parseInt(formLink.id_rol),
                id_epi: rolEsSecretario() ? parseInt(formLink.id_epi || '') : null,
                id_usuario_emisor: user?.id_usuario ?? null,
            });
            const url = `${URL_BASE}/registro-oficial/${res.token}`;
            setLinkGenerado({ url, token: res.token, rol: res.rol?.nombre, epi: res.epi?.nombre });
            cargarTodo();
        } catch (err) {
            const detalle = err.errors ? Object.values(err.errors).flat().join(' · ') : (err.message || 'No se pudo generar el enlace.');
            setMensaje({ tipo: 'error', texto: detalle });
        } finally {
            setProcesando(false);
        }
    };

    const copiar = (texto) => {
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(texto).then(() => setMensaje({ tipo: 'success', texto: 'Enlace copiado al portapapeles.' }));
        } else {
            const ta = document.createElement('textarea');
            ta.value = texto;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setMensaje({ tipo: 'success', texto: 'Enlace copiado al portapapeles.' });
        }
    };

    const waLink = () => {
        const cel = celularWa.replace(/[^0-9]/g, '');
        const texto = encodeURIComponent(`Estimado(a), la POLICÍA BOLIVIANA (OFBOL) le invita a completar su registro oficial. Por favor ingrese al siguiente enlace y adjunte su memo de designación: ${linkGenerado.url}`);
        return cel ? `https://wa.me/${cel}?text=${texto}` : `https://wa.me/?text=${texto}`;
    };

    // ── Detalle de solicitud ──
    const abrirDetalle = async (s) => {
        setCargandoDetalle(true);
        setDetalle(s);
        try {
            const data = await api.get(`/solicitudes-registro/${s.id_solicitud}`);
            setDetalle(data);
        } catch (_) { /* usa la fila de la lista */ } finally {
            setCargandoDetalle(false);
        }
    };

    const verificarIA = async (s) => {
        setProcesando(true);
        try {
            const res = await api.post(`/solicitudes-registro/${s.id_solicitud}/verificar-ia`, {});
            setMensaje({ tipo: res.solicitud?.ia_advertencia ? 'warning' : 'success', texto: res.message });
            setDetalle(res.solicitud);
            cargarTodo();
        } catch (err) {
            const detalle = err.errors ? Object.values(err.errors).flat().join(' · ') : (err.message || 'Error al verificar con la IA.');
            setMensaje({ tipo: 'error', texto: detalle });
            cargarTodo();
        } finally {
            setProcesando(false);
        }
    };

    const aprobar = async (s) => {
        const confirmado = await pedir({
            titulo: 'Aprobar el registro',
            mensaje: `Se activará la cuenta «${s.usuario}» de ${s.nombres} ${s.apellidos}.`,
            detalle: 'El oficial podrá ingresar al sistema.',
            tono: 'oliva',
            confirmarTexto: 'Aprobar y activar',
        });
        if (!confirmado) return;
        setProcesando(true);
        try {
            const res = await api.post(`/solicitudes-registro/${s.id_solicitud}/aprobar`, {});
            setMensaje({ tipo: 'success', texto: res.message });
            if (detalle?.id_solicitud === s.id_solicitud) setDetalle(res.solicitud);
            cargarTodo();
        } catch (err) {
            setMensaje({ tipo: 'error', texto: err.message || 'Error al aprobar.' });
        } finally {
            setProcesando(false);
        }
    };

    const rechazar = async (e) => {
        e?.preventDefault?.();
        if (!motivoRechazo.trim()) {
            setMensaje({ tipo: 'error', texto: 'Debe indicar el motivo del rechazo.' });
            return;
        }
        setProcesando(true);
        try {
            const res = await api.post(`/solicitudes-registro/${modalRechazo.id_solicitud}/rechazar`, { observacion: motivoRechazo.trim() });
            setMensaje({ tipo: 'warning', texto: res.message });
            setModalRechazo(false);
            setMotivoRechazo('');
            setDetalle(res.solicitud);
            cargarTodo();
        } catch (err) {
            setMensaje({ tipo: 'error', texto: err.message || 'Error al rechazar.' });
        } finally {
            setProcesando(false);
        }
    };

    const cancelarLink = async (l) => {
        const confirmado = await pedir({
            titulo: 'Cancelar el enlace',
            mensaje: 'El enlace dejará de aceptar registros de oficiales.',
            detalle: 'Los registros ya recibidos no se ven afectados.',
            tono: 'crimson',
            confirmarTexto: 'Cancelar enlace',
        });
        if (!confirmado) return;
        try {
            await api.post(`/registro-links/${l.id_link}/cancelar`, {});
            setMensaje({ tipo: 'success', texto: 'Enlace cancelado.' });
            cargarTodo();
        } catch (err) {
            setMensaje({ tipo: 'error', texto: err.message || 'Error al cancelar.' });
        }
    };

    const stats = useMemo(() => {
        const recibidas = solicitudes.filter((s) => s.estado_solicitud === 'recibida' || s.estado_solicitud === 'verificada').length;
        const aprobadas = solicitudes.filter((s) => s.estado_solicitud === 'aprobada').length;
        const advertencias = solicitudes.filter((s) => s.ia_advertencia).length;
        const activos = links.filter((l) => l.estado === 'activo').length;
        return { recibidas, aprobadas, advertencias, activos };
    }, [solicitudes, links]);

    const resultadoIA = (s) => {
        const chips = [];
        if (s.ia_firma === true) chips.push({ t: 'Firma', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' });
        else if (s.ia_firma === false) chips.push({ t: 'Sin firma', cls: 'bg-red-50 text-red-700 border-red-200' });
        if (s.ia_sello === true) chips.push({ t: 'Sello', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' });
        else if (s.ia_sello === false) chips.push({ t: 'Sin sello', cls: 'bg-red-50 text-red-700 border-red-200' });
        // Los nombres detectados se guardan como JSON string en ia_nombres
        let nombresMemo = [];
        if (Array.isArray(s.nombres_detectados)) nombresMemo = s.nombres_detectados;
        else if (typeof s.ia_nombres === 'string' && s.ia_nombres) {
            try { nombresMemo = JSON.parse(s.ia_nombres); } catch (_) { nombresMemo = []; }
        }
        if (Array.isArray(nombresMemo) && nombresMemo.length > 0) {
            chips.push({ t: `Memo: ${nombresMemo.join(', ')}`, cls: 'bg-blue-50 text-blue-800 border-blue-200' });
        }
        // Resultado de la verificación de rostro en la foto de perfil
        if (s.ia_rostro === true) chips.push({ t: 'Rostro OK', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' });
        else if (s.ia_rostro === false) chips.push({ t: 'Sin rostro', cls: 'bg-red-50 text-red-700 border-red-200' });
        return chips;
    };

    return (
        <LayoutComandoGeneral>
            <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 ofbol-page-enter">
                {/* ─ Header ─ */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#e6efec] text-[#2a351a] border border-[#cbe4df]">
                                Vinculación y Seguridad
                            </span>
                            <span className="text-xs text-slate-400">· Registro externo de oficiales</span>
                        </div>
                        <div className="mb-2">
                            <ChipEnVivo conectado={conectado} />
                        </div>
                        <h1 className="ofbol-display heading-balance">
                            Registro de Oficiales y Verificación IA
                        </h1>
                        <p className="text-sm text-slate-500 mt-0.5">
                            Genere el enlace de registro, verifique con la IA local (firma · sello · identidad del memo) y active la cuenta del oficial.
                        </p>
                    </div>
                    <button
                        onClick={() => { setModalLink(true); setLinkGenerado(null); }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#33401f] hover:bg-[#0f312c] text-white text-xs font-black rounded-xl transition-colors shadow-sm self-start sm:self-auto"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-4 4a4 4 0 01-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l4-4a4 4 0 015.656 5.656l-1.5 1.5" />
                        </svg>
                        Generar link de registro
                    </button>
                </div>

                {mensaje && <Alert type={mensaje.tipo} onClose={() => setMensaje(null)}>{mensaje.texto}</Alert>}

                {/* ─ Métricas ─ */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'En verificación', value: stats.recibidas, color: 'text-blue-900', chip: 'bg-blue-50' },
                        { label: 'Cuentas activadas', value: stats.aprobadas, color: 'text-emerald-900', chip: 'bg-emerald-50' },
                        { label: 'Advertencias IA', value: stats.advertencias, color: 'text-red-900', chip: 'bg-red-50' },
                        { label: 'Links activos', value: stats.activos, color: 'text-teal-900', chip: 'bg-teal-50' },
                    ].map((m) => (
                        <div key={m.label} className={`${m.chip} rounded-[14px] p-4 border border-slate-100`}>
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{m.label}</p>
                            <p className={`text-2xl font-black mt-1 ${m.color}`}>{m.value}</p>
                        </div>
                    ))}
                </div>

                {/* ─ Links generados ─ */}
                {links.length > 0 && (
                    <div className="bg-white rounded-[14px] border border-slate-100 p-5">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Enlaces de registro generados</h3>
                        <div className="space-y-2">
                            {links.slice(0, 8).map((l) => (
                                <div key={l.id_link} className="flex flex-wrap items-center gap-2 text-xs bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                                    <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                        l.estado === 'activo' ? 'bg-emerald-50 text-emerald-700' : l.estado === 'usado' ? 'bg-slate-100 text-slate-500' : 'bg-red-50 text-red-700'
                                    }`}>{l.estado}</span>
                                    <span className="font-bold text-slate-800">{l.rol?.nombre}</span>
                                    {l.epi && <span className="text-slate-500">{l.epi?.nombre}</span>}
                                    <span className="text-slate-400">{fmtFecha(l.creado_en)}</span>
                                    <span className="text-slate-400">· {l.solicitudes?.length ?? 0} solicitud(es)</span>
                                    <div className="ml-auto flex gap-1.5">
                                        <button onClick={() => copiar(`${URL_BASE}/registro-oficial/${l.token}`)} className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-600 hover:bg-slate-100">Copiar</button>
                                        {l.estado === 'activo' && (
                                            <button onClick={() => cancelarLink(l)} className="px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 font-bold text-red-700 hover:bg-red-100">Cancelar</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ─ Tabla de solicitudes ─ */}
                <div className="bg-white rounded-[14px] border border-slate-100 overflow-hidden">
                    {loading ? (
                        <div className="py-20 flex justify-center"><Spinner /></div>
                    ) : solicitudes.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 space-y-2">
                            <IdCard size={30} strokeWidth={1.5} className="mx-auto text-slate-300" aria-hidden="true" />
                            <p className="text-xs font-bold">Aún no hay solicitudes de registro</p>
                            <p className="text-xs">Genere un link y envíelo al oficial por WhatsApp para que complete su registro.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                        <th className="px-4 py-3">Fecha</th>
                                        <th className="px-4 py-3">Registrado</th>
                                        <th className="px-4 py-3">Celular</th>
                                        <th className="px-4 py-3">Rol / EPI</th>
                                        <th className="px-4 py-3">Cuenta</th>
                                        <th className="px-4 py-3">Estado IA</th>
                                        <th className="px-4 py-3">Advertencia</th>
                                        <th className="px-4 py-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {solicitudes.map((s) => {
                                        const be = BADGES_ESTADO[s.estado_solicitud] ?? BADGES_ESTADO.recibida;
                                        const bi = BADGES_IA[s.ia_estado] ?? BADGES_IA.pendiente;
                                        return (
                                            <tr key={s.id_solicitud} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{fmtFecha(s.creado_en)}</td>
                                                <td className="px-4 py-3">
                                                    <p className="font-bold text-slate-900">{s.nombres} {s.apellidos}</p>
                                                    <p className="text-[10px] text-slate-400">{s.ci ? `CI ${s.ci}` : ''}</p>
                                                    {s.ruta_foto && (
                                                        <img
                                                            src={`/storage/${s.ruta_foto}`}
                                                            alt="Foto de perfil"
                                                            className="mt-1 w-8 h-8 rounded-lg object-cover border border-slate-200"
                                                        />
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-slate-600">{s.telefono}</td>
                                                <td className="px-4 py-3">
                                                    <p className="font-semibold text-slate-800">{s.rol?.nombre ?? `Rol ${s.id_rol}`}</p>
                                                    {s.epi?.nombre && <p className="text-[10px] text-slate-400">{s.epi.nombre}</p>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${be.cls}`}>{be.label}</span>
                                                    <p className="font-mono text-[10px] text-slate-500 mt-0.5">{s.usuario}</p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${bi.cls}`}>{bi.label}</span>
                                                    {s.ia_estado === 'procesada' && (
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {resultadoIA(s).map((c, i) => (
                                                                <span key={i} className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${c.cls}`}>{c.t}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {s.ia_advertencia ? (
                                                        <span title={s.ia_mensaje || ''} className="px-2 py-1 rounded-md bg-red-50 text-red-700 border border-red-200 text-[10px] font-black cursor-help">
                                                            No coincide
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                                                    <button onClick={() => abrirDetalle(s)} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold">Ver</button>
                                                    <button
                                                        onClick={() => verificarIA(s)}
                                                        disabled={procesando}
                                                        className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold disabled:opacity-40"
                                                    >
                                                        {s.ia_estado === 'procesada' ? 'Re-verificar IA' : 'Verificar IA'}
                                                    </button>
                                                    {s.estado_solicitud !== 'aprobada' && s.estado_solicitud !== 'rechazada' && (
                                                        <>
                                                            <button onClick={() => aprobar(s)} disabled={procesando} className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-40">Aprobar</button>
                                                            <button onClick={() => { setModalRechazo(s); setMotivoRechazo(''); }} disabled={procesando} className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold disabled:opacity-40">Rechazar</button>
                                                        </>
                                                    )}
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

            {/* ═══ MODAL: Generar link ═══ */}
            <Modal open={modalLink} onClose={() => setModalLink(false)} title="Generar link de registro" size="md">
                <form onSubmit={generarLink} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="link-rol" className="text-[10px] font-black uppercase text-slate-500 block mb-1">Rol que recibirá *</label>
                            <select aria-label="Filtro"
                                id="link-rol"
                                value={formLink.id_rol}
                                onChange={(e) => setFormLink((f) => ({ ...f, id_rol: e.target.value }))}
                                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus-visible:ring-2 focus-visible:ring-[#33401f]"
                            >
                                {roles.map((r) => (
                                    <option key={r.id_rol} value={r.id_rol}>{r.nombre}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="link-epi" className="text-[10px] font-black uppercase text-slate-500 block mb-1">EPI asignada {rolEsSecretario() ? '*' : '(opcional)'}</label>
                            <select aria-label="Filtro"
                                id="link-epi"
                                value={formLink.id_epi}
                                onChange={(e) => setFormLink((f) => ({ ...f, id_epi: e.target.value }))}
                                disabled={!rolEsSecretario()}
                                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[#33401f]"
                            >
                                {rolEsSecretario() && <option value="">Seleccione EPI…</option>}
                                {epis.map((ep) => (
                                    <option key={ep.id_epi} value={ep.id_epi}>{ep.nombre}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                        Se generará un enlace único. Envíelo al oficial (WhatsApp, correo…) para que complete el formulario y adjunte su memo de designación.
                    </p>

                    {linkGenerado ? (
                        <div className="space-y-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                            <p className="text-xs font-black text-emerald-800">Enlace generado — {linkGenerado.rol}{linkGenerado.epi ? ` · ${linkGenerado.epi}` : ''}</p>
                            <div className="flex items-center gap-2">
                                <input readOnly aria-label="Enlace de registro generado" value={linkGenerado.url} onFocus={(e) => e.target.select()} className="w-full text-[10px] font-mono bg-white border border-emerald-200 rounded-lg px-2.5 py-2" />
                                <button type="button" onClick={() => copiar(linkGenerado.url)} className="px-3 py-2 bg-[#33401f] text-white rounded-lg text-[11px] font-black shrink-0">Copiar</button>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input aria-label="Celular del oficial (opcional) ej. 59171234567"
                                    type="tel"
                                    value={celularWa}
                                    onChange={(e) => setCelularWa(e.target.value)}
                                    placeholder="Celular del oficial (opcional) ej. 59171234567"
                                    className="w-full text-xs p-2 bg-white border border-emerald-200 rounded-lg focus-visible:ring-2 focus-visible:ring-emerald-400"
                                />
                                <a href={waLink()} target="_blank" rel="noreferrer" className="px-3 py-2 bg-[#1a5c52] text-white rounded-lg text-[11px] font-black text-center shrink-0 whitespace-nowrap">
                                    Enviar por WhatsApp
                                </a>
                            </div>
                            <button type="button" onClick={() => { setLinkGenerado(null); setModalLink(false); }} className="text-[11px] font-bold text-emerald-800 underline">
                                Listo, cerrar
                            </button>
                        </div>
                    ) : (
                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                            <button type="button" onClick={() => setModalLink(false)} className="px-4 py-2 text-xs font-bold text-slate-600 rounded-lg">Cancelar</button>
                            <button type="submit" disabled={procesando || (rolEsSecretario() && !formLink.id_epi)} className="px-5 py-2 bg-[#33401f] hover:bg-[#0f312c] text-white text-xs font-black rounded-xl disabled:opacity-50">
                                {procesando ? 'Generando…' : 'Generar enlace'}
                            </button>
                        </div>
                    )}
                </form>
            </Modal>

            {/* ═══ MODAL: Detalle de solicitud ═══ */}
            <Modal
                open={!!detalle && !modalRechazo}
                onClose={() => setDetalle(null)}
                title={`Solicitud #${detalle?.id_solicitud ?? ''} — ${detalle?.nombres ?? ''} ${detalle?.apellidos ?? ''}`}
                size="xl"
            >
                {!detalle ? null : cargandoDetalle ? (
                    <div className="py-10 flex justify-center"><Spinner /></div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                        {/* Columna izquierda: datos + verificación IA */}
                        <div className="space-y-4 min-w-0">
                            {/* Datos */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                                {[
                                    ['Celular', detalle.telefono],
                                    ['Cédula de identidad', detalle.ci || '—'],
                                    ['Usuario asignado', detalle.usuario],
                                    ['Rol', detalle.rol?.nombre ?? detalle.id_rol],
                                    ['EPI', detalle.epi?.nombre ?? 'Nivel Central'],
                                    ['Recibido', fmtFecha(detalle.creado_en)],
                                ].map(([l, v]) => (
                                    <div key={l} className="bg-slate-50 rounded-xl p-3">
                                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{l}</p>
                                        <p className="font-bold text-slate-800 mt-0.5 break-words">{v}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Foto de perfil + resultado de rostro */}
                            {detalle.ruta_foto && (
                                <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                                    <img
                                        src={`/storage/${detalle.ruta_foto}`}
                                        alt="Foto de perfil del solicitante"
                                        className="w-16 h-16 rounded-xl object-cover border border-slate-200"
                                    />
                                    <div className="text-xs">
                                        <p className="font-black uppercase tracking-wider text-slate-400 text-[9px]">Foto de perfil · verificación IA</p>
                                        {detalle.ia_rostro === true && <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">Rostro humano detectado</span>}
                                        {detalle.ia_rostro === false && <span className="px-2 py-0.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-[11px] font-bold">No parece un rostro</span>}
                                        {detalle.ia_rostro === null || detalle.ia_rostro === undefined ? (
                                            <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-bold">Sin verificar aún</span>
                                        ) : null}
                                    </div>
                                </div>
                            )}

                            {/* Estado */}
                            <div className="flex flex-wrap gap-2 items-center text-[11px]">
                                <span className={`px-2.5 py-1 rounded-md font-black border ${(BADGES_ESTADO[detalle.estado_solicitud] ?? BADGES_ESTADO.recibida).cls}`}>
                                    {(BADGES_ESTADO[detalle.estado_solicitud] ?? BADGES_ESTADO.recibida).label}
                                </span>
                                <span className={`px-2.5 py-1 rounded-md font-bold ${(BADGES_IA[detalle.ia_estado] ?? BADGES_IA.pendiente).cls}`}>
                                    {(BADGES_IA[detalle.ia_estado] ?? BADGES_IA.pendiente).label}
                                </span>
                                {detalle.ia_advertencia && (
                                    <span className="px-2.5 py-1 rounded-md font-black bg-red-600 text-white">ADVERTENCIA DE IDENTIDAD</span>
                                )}
                            </div>

                            {/* Resultado IA */}
                            <div className="rounded-xl border border-slate-200 overflow-hidden">
                                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-500">
                                    Verificación IA del memo de designación
                                </div>
                                <div className="p-4 space-y-3">
                                    <div className="flex flex-wrap gap-2">
                                        {detalle.ia_firma === true && <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">Firma detectada</span>}
                                        {detalle.ia_firma === false && <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 text-[11px] font-bold">Sin firma</span>}
                                        {detalle.ia_sello === true && <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">Sello detectado</span>}
                                        {detalle.ia_sello === false && <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 text-[11px] font-bold">Sin sello</span>}
                                        {detalle.ia_firma === null && <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-bold">Sin verificar aún</span>}
                                    </div>

                                    {detalle.ia_nombres && (() => { try {
                                        const n = JSON.parse(detalle.ia_nombres);
                                        return n.length > 0 ? (
                                            <p className="text-xs text-slate-600">
                                                <strong>Nombres detectados en el memo:</strong> {n.join(', ')}
                                            </p>
                                        ) : null;
                                    } catch (_) { return null; } })()}

                                    {detalle.ia_coincide === false && (
                                        <Alert type="warning">
                                            El nombre con el que se registró (<strong>{detalle.nombres} {detalle.apellidos}</strong>) no coincide con el memo de designación subido.
                                        </Alert>
                                    )}
                                    {detalle.ia_mensaje && (
                                        <p className={`text-xs font-medium ${detalle.ia_advertencia ? 'text-amber-700' : 'text-emerald-700'}`}>
                                            {detalle.ia_mensaje}
                                        </p>
                                    )}
                                    {detalle.ia_estado === 'error' && (
                                        <Alert type="error">
                                            {detalle.ia_mensaje || 'No se pudo contactar a la IA local. Verifique IA_URL en el .env.'}
                                        </Alert>
                                    )}

                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                        <button onClick={() => verificarIA(detalle)} disabled={procesando} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl disabled:opacity-50">
                                            {procesando ? 'Verificando…' : detalle.ia_estado === 'procesada' ? 'Re-verificar con IA' : 'Verificar con IA local'}
                                        </button>
                                        {detalle.estado_solicitud !== 'aprobada' && detalle.estado_solicitud !== 'rechazada' && (
                                            <>
                                                <button onClick={() => aprobar(detalle)} disabled={procesando} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl disabled:opacity-50">
                                                    Aprobar y activar cuenta
                                                </button>
                                                <button onClick={() => setModalRechazo(detalle)} disabled={procesando} className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-xs font-black rounded-xl disabled:opacity-50">
                                                    Rechazar
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {detalle.observacion && (
                                <Alert type="warning">
                                    <strong>Observación:</strong> {detalle.observacion}
                                </Alert>
                            )}
                        </div>

                        {/* Columna derecha: documento en vivo */}
                        {detalle.ruta_memo && (
                            <div className="min-w-0 flex flex-col">
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                        Memo de designación adjunto
                                    </p>
                                    <a
                                        href={`/storage/${detalle.ruta_memo}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-1"
                                    >
                                        Abrir en pestaña ↗
                                    </a>
                                </div>
                                <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex-1 min-h-[420px] xl:min-h-[520px]">
                                    <iframe
                                        key={detalle.ia_verificado_en || detalle.id_solicitud}
                                        src={`/storage/${detalle.ruta_memo}`}
                                        title="Memo de designación"
                                        className="w-full h-full min-h-[420px] xl:min-h-[520px]"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* ═══ MODAL: Rechazo ═══ */}
            <Modal open={!!modalRechazo} onClose={() => setModalRechazo(false)} title={`Rechazar registro de ${modalRechazo?.nombres ?? ''} ${modalRechazo?.apellidos ?? ''}`} size="sm">
                <form onSubmit={rechazar} className="space-y-3">
                    <textarea aria-label="Indique el motivo del rechazo (ej. el nombre no coincide con el memo de designación)…"
                        rows={4}
                        value={motivoRechazo}
                        onChange={(e) => setMotivoRechazo(e.target.value)}
                        placeholder="Indique el motivo del rechazo (ej. el nombre no coincide con el memo de designación)…"
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus-visible:ring-2 focus-visible:ring-red-400"
                    />
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setModalRechazo(false)} className="px-4 py-2 text-xs font-bold text-slate-600 rounded-lg">Cancelar</button>
                        <button type="submit" disabled={procesando} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl disabled:opacity-50">
                            {procesando ? 'Procesando…' : 'Confirmar rechazo'}
                        </button>
                    </div>
                </form>
            </Modal>
            {Confirmacion}
        </LayoutComandoGeneral>
    );
}
