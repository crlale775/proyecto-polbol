/**
 * OficialesEpi.jsx — Personal Policial Asignado a la EPI
 * Diseño estilo PolBol: sidebar oscura (layout) + contenido claro,
 * banner oliva, tarjetas blancas con acentos de color, mayúsculas.
 * Conecta con:
 *   - OficialController   → GET /api/oficiales?id_epi=X
 *   - GradoController     → GET /api/grados
 *   - CargoController     → GET /api/cargos
 *   - DocumentoController → GET /api/documentos?id_oficial=X (historial descargable)
 */
import React, { useState, useEffect } from 'react';
import LayoutSecretario from '../../js/components/LayoutSecretario';
import Spinner from '../../js/components/ui/Spinner';
import AvatarFoto from '../../js/components/ui/AvatarFoto';
import EstadoBadge from '../../js/components/ui/EstadoBadge';
import CampoDato from '../repertorios/ui/CampoDato';
import { useAuth } from '../../js/context/AuthContext';
import api from '../../js/lib/api';

/* ============================================================
   ANIMACIONES — CSS puro (rápidas y fluidas, sin librerías)
   ============================================================ */
const ANIM_STYLES = `
@keyframes oaFadeUp {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
}
@keyframes oaScaleIn {
    from { opacity: 0; transform: scale(0.97) translateY(8px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
}
.oa-fade-up   { animation: oaFadeUp 0.4s cubic-bezier(0.22, 1, 0.36, 1) both; }
.oa-scale-in  { animation: oaScaleIn 0.22s cubic-bezier(0.22, 1, 0.36, 1) both; }
@media (prefers-reduced-motion: reduce) {
    .oa-fade-up, .oa-scale-in { animation: none; }
}
`;

// Acentos de color superior por tarjeta (estilo métricas PolBol)
const CARD_ACCENTS = [
    'border-t-[#28441f]',
    'border-t-[#9a6f0a]',
    'border-t-[#8b4513]',
    'border-t-[#1a5c52]',
    'border-t-[#5a6b3d]',
    'border-t-[#8f2020]',
];

const AVATAR_COLORS = [
    'bg-[#28441f]',
    'bg-[#3d5226]',
    'bg-[#56692f]',
    'bg-[#495456]',
    'bg-[#56692f]',
    'bg-[#28441f]',
];

function formatearFecha(f, conHora = false) {
    if (!f) return '—';
    return new Date(f).toLocaleDateString('es-BO', {
        day: '2-digit', month: 'short', year: 'numeric',
        ...(conHora ? { hour: '2-digit', minute: '2-digit' } : {}),
    });
}

// Archivos de respaldo de un trámite: el PDF actual + las versiones históricas
// (incluye los archivos observados/devueltos que fueron corregidos después).
function archivosDelDocumento(doc) {
    const archivos = [];
    const vistos = new Set();

    (doc.versiones ?? [])
        .slice()
        .toSorted((a, b) => (a.version ?? 0) - (b.version ?? 0))
        .forEach((v) => {
            if (!v.ruta_pdf || vistos.has(v.ruta_pdf)) return;
            vistos.add(v.ruta_pdf);
            if (v.ruta_pdf === doc.ruta_pdf) {
                archivos.push({ ruta: v.ruta_pdf, label: 'ARCHIVO ACTUAL', fecha: v.fecha, actual: true });
            } else {
                archivos.push({ ruta: v.ruta_pdf, label: `VERSIÓN ${v.version ?? ''} (ANTERIOR)`, fecha: v.fecha });
            }
        });

    // Siempre incluir el archivo vigente (aunque no tenga versiones registradas)
    if (doc.ruta_pdf && !vistos.has(doc.ruta_pdf)) {
        archivos.push({ ruta: doc.ruta_pdf, label: 'ARCHIVO ACTUAL', fecha: doc.fecha_subida, actual: true });
    }

    return archivos;
}

// Tarjeta de un documento en el historial del oficial (con descarga)
function DocHistorial({ doc }) {
    const archivos = archivosDelDocumento(doc);
    const observaciones = (doc.revisiones ?? []).filter(
        (r) => String(r.estado || '').toLowerCase().includes('observ') || String(r.estado || '').toLowerCase().includes('devuelto')
    );
    const ultimaObs = observaciones.length > 0 ? observaciones[observaciones.length - 1] : null;

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            {/* Encabezado del trámite */}
            <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#f0f4ec] border border-[#c8d6b8] text-[#28441f] flex items-center justify-center text-sm shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 4H7a2 2 0 01-2-2V6a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
                    </svg>
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-mono text-xs font-bold text-slate-900">{doc.codigo_documento}</p>
                        <EstadoBadge nombre={doc.estado?.nombre ?? 'Borrador'} />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate uppercase tracking-wide">
                        {doc.tipo_documento?.nombre ?? 'Documento'} · {formatearFecha(doc.fecha_subida)}
                    </p>
                    <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-1">REF: {doc.referencia}</p>
                </div>
            </div>

            {/* Motivo de observación / devolución (aunque ya haya sido corregido) */}
            {ultimaObs && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px]">
                    <p className="font-bold uppercase tracking-wide text-amber-800">                            {ultimaObs.estado}: {ultimaObs.tipo_observacion?.nombre ?? 'Observación registrada'}
                    </p>
                    <p className="text-amber-900 mt-0.5 italic">"{ultimaObs.observacion_libre || '—'}"</p>
                    <p className="text-amber-600 mt-0.5">
                        {formatearFecha(ultimaObs.fecha, true)}
                        {ultimaObs.revisor?.usuario ? ` · POR ${ultimaObs.revisor.usuario}` : ''}
                    </p>
                </div>
            )}

            {/* Archivos de respaldo descargables */}
            {archivos.length > 0 && (
                <div className="space-y-1.5">
                    {archivos.map((a) => (
                        <div key={a.ruta} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 min-w-0 flex-1 truncate">{a.label}</span>
                            <a
                                href={`/storage/${a.ruta}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="VER PDF"
                                className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-[#28441f] px-2 py-1 rounded-lg hover:bg-[#f0f4ec] transition-colors shrink-0"
                            >
                                VER
                            </a>
                            <a
                                href={`/storage/${a.ruta}`}
                                download
                                title="DESCARGAR PDF"
                                className="text-[10px] font-bold uppercase tracking-wider text-white bg-[#28441f] hover:bg-[#3d5226] px-2.5 py-1 rounded-lg transition-colors shrink-0"
                            >
                                DESCARGAR
                            </a>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function OficialesEpi() {
    const { user } = useAuth();
    const [oficiales, setOficiales] = useState([]);
    const [grados, setGrados] = useState([]);
    const [cargos, setCargos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [filtroGrado, setFiltroGrado] = useState('todos');
    const [filtroEstado, setFiltroEstado] = useState('todos');
    const [filtroCategoria, setFiltroCategoria] = useState('todos');
    const [oficialModal, setOficialModal] = useState(null);
    const [docsOficial, setDocsOficial] = useState([]);
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [docsError, setDocsError] = useState(null);

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);
                // Filtrar solo los oficiales de la EPI asignada al secretario
                const params = user?.id_epi ? `?id_epi=${user.id_epi}` : '';
                const [ofRes, grRes, carRes] = await Promise.all([
                    api.get(`/oficiales${params}`),
                    api.get('/grados'),
                    api.get('/cargos'),
                ]);
                if (Array.isArray(ofRes)) setOficiales(ofRes);
                if (Array.isArray(grRes)) setGrados(grRes);
                if (Array.isArray(carRes)) setCargos(carRes);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [user]);

    // Helper: categoría de escalafón desde el nombre del grado
    const getCategoria = (oficial) => {
        const g = (oficial.grado?.nombre || '').toLowerCase();
        if (['coronel','teniente coronel','mayor','capitán','teniente','subteniente'].some(x => g.includes(x))) return 'of';
        if (g.includes('admin') || g.includes('plantel')) return 'adm';
        return 'pp'; // Policía Profesional (engloba a BF y CB históricos)
    };

    const filtrados = oficiales.filter((o) => {
        const q = busqueda.toLowerCase();
        const nombres = `${o.nombres || ''} ${o.apellidos || ''}`.toLowerCase();
        const ci = o.ci?.toLowerCase() || '';
        const escalafon = o.escalafon?.toLowerCase() || '';
        const grado = o.grado?.nombre?.toLowerCase() || '';
        const cargo = o.cargo?.nombre?.toLowerCase() || '';

        const coincideBusqueda = nombres.includes(q) || ci.includes(q) || escalafon.includes(q) || grado.includes(q) || cargo.includes(q);
        const coincideGrado = filtroGrado === 'todos' || String(o.id_grado) === String(filtroGrado);
        const activo = o.estado !== false;
        const coincideEstado = filtroEstado === 'todos' || (filtroEstado === 'activos' && activo) || (filtroEstado === 'inactivos' && !activo);
        const coincideCategoria = filtroCategoria === 'todos' || getCategoria(o) === filtroCategoria;

        return coincideBusqueda && coincideGrado && coincideEstado && coincideCategoria;
    });

    const activos = oficiales.filter((o) => o.estado !== false).length;

    // Abre la ficha del oficial y carga su historial de documentos (respaldo)
    const abrirFicha = async (o) => {
        setOficialModal(o);
        setDocsOficial([]);
        setDocsError(null);
        setLoadingDocs(true);
        try {
            const res = await api.get(`/documentos?id_oficial=${o.id_oficial}`);
            setDocsOficial(Array.isArray(res) ? res : []);
        } catch (err) {
            console.error(err);
            setDocsError('NO SE PUDIERON CARGAR LOS DOCUMENTOS DE ESTE EFECTIVO.');
        } finally {
            setLoadingDocs(false);
        }
    };

    const estiloSelect = 'text-xs font-semibold uppercase tracking-wider bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 focus:border-[#28441f]/50 focus:ring-2 focus:ring-[#3d4a2c]/10 focus:outline-none transition-colors cursor-pointer';

    return (
        <LayoutSecretario>
            <style>{ANIM_STYLES}</style>

            <div className="p-6 max-w-7xl mx-auto space-y-6 ofbol-page-enter">
                {/* ====== BANNER HERO (oliva oscuro, estilo PolBol) ====== */}
                <div className="oa-fade-up relative overflow-hidden bg-gradient-to-br from-[#1a331a] to-[#111810] rounded-[14px] px-7 py-6 text-white">
                    {/* Gráfico circular decorativo sutil */}
                    <div className="pointer-events-none absolute -right-10 -top-16 w-64 h-64 rounded-full border border-white/5" />
                    <div className="pointer-events-none absolute -right-4 -top-10 w-44 h-44 rounded-full border border-white/5" />

                    <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a8c056]">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Dotación de Personal · {user?.epi || 'EPI POLICIAL'}
                            </span>
                            <h1 className="ofbol-display heading-balance">
                                Personal Policial de la Unidad
                            </h1>
                            <p className="text-xs sm:text-sm text-white/60 mt-2 max-w-xl leading-relaxed uppercase tracking-wide">
                                Nómina de oficiales, suboficiales y sargentos asignados a esta estación policial integral.
                            </p>
                        </div>

                        {/* Indicadores */}
                        <div className="flex items-center gap-5 shrink-0">
                            <div className="text-right">
                                <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/50">Efectivos en Dotación</p>
                                <p className="text-3xl font-black text-[#e8b923] leading-none mt-1 tabular-nums">{activos}</p>
                            </div>
                            <div className="w-px h-11 bg-white/15" />
                            <div className="text-left">
                                <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/50">Total Registrados</p>
                                <p className="text-3xl font-black text-white leading-none mt-1 tabular-nums">{oficiales.length}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ====== FILTROS ====== */}
                <div className="oa-fade-up bg-white rounded-[14px] p-4 border border-slate-200" style={{ animationDelay: '80ms' }}>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="sm:col-span-2 relative">
                            <svg className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input aria-label="BUSCAR POR NOMBRE, C.I., ESCALAFÓN O CARGO..."
                                type="text"
                                placeholder="BUSCAR POR NOMBRE, C.I., ESCALAFÓN O CARGO..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                className="w-full pl-10 pr-3 py-2.5 text-xs uppercase tracking-wide bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#28441f]/50 focus:ring-2 focus:ring-[#3d4a2c]/10 focus:outline-none transition-colors"
                            />
                        </div>

                        {/* Filtro por categoría de escalafón */}
                        <select aria-label="Filtro de filtroCategoria" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className={estiloSelect}>
                            <option value="todos">Todas las Categorías</option>
                            <option value="of">OF — Oficial</option>
                            <option value="pp">PP — Policía Profesional (BF / CB)</option>
                            <option value="adm">ADM — Plantel Administrativo</option>
                        </select>

                        <select aria-label="Filtrar por estado" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className={estiloSelect}>
                            <option value="todos">Todos los Estados</option>
                            <option value="activos">Activos</option>
                            <option value="inactivos">Inactivos</option>
                        </select>
                    </div>
                </div>

                {/* ====== TARJETAS ====== */}
                {loading ? (
                    <div className="oa-fade-up py-20 flex flex-col items-center gap-3">
                        <Spinner size="lg" />
                        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">Cargando dotación...</p>
                    </div>
                ) : filtrados.length === 0 ? (
                    <div className="oa-fade-up bg-white rounded-[14px] p-14 text-center border border-slate-200">
                        <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <p className="text-sm font-bold uppercase tracking-widest text-slate-600">
                            Sin resultados con los filtros indicados
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filtrados.map((o, idx) => {
                            const activo = o.estado !== false;
                            return (
                                <div
                                    key={o.id_oficial}
                                    className={`oa-fade-up group bg-white rounded-[14px] border border-slate-200 border-t-4 p-5 flex flex-col gap-4 transition-colors duration-200 hover:-translate-y-1 ${CARD_ACCENTS[idx % CARD_ACCENTS.length]}`}
                                    style={{ animationDelay: `${100 + idx * 60}ms` }}
                                >
                                    {/* Cabecera de la tarjeta */}
                                    <div className="flex items-start gap-3">
                                        <AvatarFoto
                                            foto={o.foto}
                                            nombre={`${o.nombres} ${o.apellidos}`}
                                            iniciales={`${o.nombres?.[0] || ''}${o.apellidos?.[0] || ''}`}
                                            className="w-12 h-12 rounded-full text-sm"
                                            fallbackClassName={AVATAR_COLORS[idx % AVATAR_COLORS.length]}
                                            ring
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="font-extrabold text-[13px] uppercase tracking-wide text-slate-900 leading-tight truncate">
                                                {o.nombres} {o.apellidos}
                                            </p>
                                            <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-[#3d5226] bg-[#f0f4ec] px-2 py-0.5 rounded border border-[#c8d6b8] mt-1.5">
                                                {o.grado?.nombre || 'Efectivo'}
                                            </span>
                                        </div>
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border shrink-0 ${
                                            activo
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-red-50 text-red-700 border-red-200'
                                        }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${activo ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                            {activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </div>

                                    {/* Datos */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <CampoDato label="C.I." value={o.ci} mono />
                                        <CampoDato label="N.° Escalafón" value={o.escalafon} mono />
                                        <CampoDato label="Cargo y Servicio" value={o.cargo?.nombre || 'Servicio General'} className="col-span-2" />
                                    </div>

                                    {/* Badge categoría escalafón */}
                                    {(() => {
                                        const cat = getCategoria(o);
                                        if (cat === 'of') return (
                                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                                                OF · Oficial
                                            </span>
                                        );
                                        if (cat === 'adm') return (
                                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
                                                ADM · Plantel Administrativo
                                            </span>
                                        );
                                        return (
                                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                                PP · Polic. Profesional
                                                <span className="text-amber-500 font-normal">(ant. BF/CB)</span>
                                            </span>
                                        );
                                    })()}

                                    {/* Acción */}
                                    <button
                                        onClick={() => abrirFicha(o)}
                                        className="mt-auto w-full group/btn inline-flex items-center justify-center gap-2 rounded-xl bg-[#28441f] hover:bg-[#3d5226] py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-white transition-colors duration-200"
                                    >
                                        VER FICHA
                                        <svg className="w-3.5 h-3.5 transition-transform duration-300 group-hover/btn:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
                                        </svg>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ====== MODAL FICHA OFICIAL ====== */}
            {oficialModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
                    <div className="oa-scale-in bg-white rounded-[14px] max-w-2xl w-full border border-slate-200 max-h-[92vh] overflow-y-auto">
                        <div className="p-6 space-y-4">
                            {/* Encabezado */}
                            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                                <div className="flex items-center gap-4 min-w-0">
                                    <AvatarFoto
                                        foto={oficialModal.foto}
                                        nombre={`${oficialModal.nombres} ${oficialModal.apellidos}`}
                                        iniciales={`${oficialModal.nombres?.[0] || ''}${oficialModal.apellidos?.[0] || ''}`}
                                        className="w-16 h-16 rounded-[14px] text-base"
                                        fallbackClassName="bg-[#28441f]"
                                    />
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2.5 mb-1">
                                            <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 truncate">
                                                {oficialModal.nombres} {oficialModal.apellidos}
                                            </h3>
                                        </div>
                                        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#3d5226] ml-3.5">
                                            {oficialModal.grado?.nombre || 'Efectivo Policial'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    aria-label="Cerrar"
                                    onClick={() => setOficialModal(null)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Datos del oficial */}
                            <div className="grid grid-cols-2 gap-3">
                                <CampoDato label="Cédula de Identidad" value={oficialModal.ci} mono />
                                <CampoDato label="N.° de Escalafón" value={oficialModal.escalafon} mono />
                                <CampoDato label="EPI Asignada" value={oficialModal.epi?.nombre} />
                                <CampoDato label="Cargo Actual" value={oficialModal.cargo?.nombre} />
                            </div>

                            {/* Badge categoría de escalafón en el modal */}
                            {(() => {
                                const cat = getCategoria(oficialModal);
                                const configs = {
                                    of:  { label: 'OF — Oficial', cls: 'bg-blue-50 text-blue-800 border-blue-200' },
                                    adm: { label: 'ADM — Plantel Administrativo', cls: 'bg-purple-50 text-purple-800 border-purple-200' },
                                    pp:  { label: 'PP — Policía Profesional · (anteriormente BF / Brigada Femenina — CB / Caballería)', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
                                };
                                const cfg = configs[cat];
                                return (
                                    <div className={`border rounded-xl px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wide flex items-center gap-2 ${cfg.cls}`}>
                                        <span className="w-2 h-2 rounded-full bg-current opacity-60 shrink-0" />
                                        Categoría de Escalafón: {cfg.label}
                                    </div>
                                );
                            })()}

                            <div className="bg-[#f0f4ec] border border-[#c8d6b8] rounded-xl px-3.5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#3d5226]">
                                Oficial habilitado para emisión y recepción de memorándums en esta unidad.
                            </div>

                            {/* Historial de documentos enviados (respaldo descargable) */}
                            <div className="border-t border-slate-200 pt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-900 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-[#28441f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Historial de Documentos
                                    </h4>
                                    {!loadingDocs && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#3d5226] bg-[#f0f4ec] border border-[#c8d6b8] px-2.5 py-1 rounded-full">
                                            {docsOficial.length} Documento{docsOficial.length !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>

                                {loadingDocs ? (
                                    <div className="flex flex-col items-center gap-2 py-6">
                                        <Spinner />
                                        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400">Cargando historial...</p>
                                    </div>
                                ) : docsError ? (
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
                                        {docsError}
                                    </p>
                                ) : docsOficial.length === 0 ? (
                                    <p className="text-[11px] text-slate-400 italic uppercase tracking-wide bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                                        Sin documentos registrados para este efectivo.
                                    </p>
                                ) : (
                                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                                        {docsOficial.map((doc) => (
                                            <DocHistorial key={doc.id_documento} doc={doc} />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Pie */}
                            <div className="pt-3 border-t border-slate-200 flex justify-end">
                                <button
                                    onClick={() => setOficialModal(null)}
                                    className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold uppercase tracking-[0.2em] transition-colors"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </LayoutSecretario>
    );
}
