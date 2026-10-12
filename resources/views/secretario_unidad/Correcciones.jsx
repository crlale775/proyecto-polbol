/**
 * Correcciones.jsx — Bandeja de Subsanación y Re-envío (Secretaría EPI)
 *
 * Flujo real de corrección de un trámite observado/devuelto:
 *   1. El secretario abre el trámite y VE lo que observó el Comando Dptal.
 *   2. Reemplaza el PDF por la versión corregida (o ajusta solo metadatos).
 *   3. La IA de visión revisa el PDF corregido ANTES de re-enviarlo
 *      (mismo servicio que usa el módulo Subir Documento: /documentos/revisar-ia).
 *   4. Vista previa lado a lado (original ⇄ corregido) + checklist del sistema experto.
 *   5. Al confirmar: se sube el PDF, se actualiza el documento, se crea una
 *      NUEVA VERSIÓN (clave para que el Comando lo vea en "Reenviados"),
 *      se registra auditoría y se notifica a quien observó el trámite.
 *
 * Rendimiento: una sola consulta a /documentos al montar (el detalle se trae
 * solo al abrir el modal); la IA corre únicamente cuando se adjunta un archivo
 * nuevo, con debounce, y nunca bloquea la carga de la vista.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import LayoutSecretario from '../../js/components/LayoutSecretario';
import EstadoBadge from '../../js/components/ui/EstadoBadge';
import Spinner from '../../js/components/ui/Spinner';
import Alert from '../../js/components/ui/Alert';
import { ChipsDato, EstadoVacio } from '../../js/components/ui/Graficos';
import { KpiPanel, ACENTOS } from '../../js/components/ui/Panel';
import { useAuth } from '../../js/context/AuthContext';
import { useToast } from '../../js/components/ui/ToastEnVivo';
import api from '../../js/lib/api';
import {
    RefreshCw, Sparkles, AlertTriangle, CheckCircle2, X, Upload,
    ShieldCheck, Eye, Clock, History, Send, FileText, Loader2,
} from 'lucide-react';

const IDS_OBSERVADO_DEVUELTO = [4, 5];
const ID_ENVIADO_POR_EPI = 2;

const esObservadoODevuelto = (d) => {
    if (IDS_OBSERVADO_DEVUELTO.includes(Number(d?.estado_actual))) return true;
    const n = (d?.estado?.nombre || '').toLowerCase();
    return n.includes('observ') || n.includes('devuel');
};

const fechaCorta = (f) => (f ? new Date(f).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

/** Días transcurridos desde la última observación (o desde la subida). */
function diasEnBandeja(doc) {
    const revs = doc?.revisiones ?? [];
    const ref = revs.length > 0 ? revs[revs.length - 1]?.fecha : doc?.fecha_subida;
    if (!ref) return 0;
    const dias = Math.floor((Date.now() - new Date(ref).getTime()) / 86400000);
    return Number.isFinite(dias) && dias > 0 ? dias : 0;
}

export default function Correcciones() {
    const { user } = useAuth();
    const mostrarToast = useToast();

    const [documentos, setDocumentos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtro, setFiltro] = useState('');
    const [tab, setTab] = useState('todos');
    const [mensaje, setMensaje] = useState(null);

    // ── Modal de subsanación ──
    const [abierto, setAbierto] = useState(false);
    const [detalle, setDetalle] = useState(null);
    const [cargandoDetalle, setCargandoDetalle] = useState(false);
    const [referencia, setReferencia] = useState('');
    const [nota, setNota] = useState('');
    const [acepto, setAcepto] = useState(false);
    const [archivo, setArchivo] = useState(null);
    const [hashNuevo, setHashNuevo] = useState(null);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [vistaPrevia, setVistaPrevia] = useState('original'); // original | corregido
    const [revisionIA, setRevisionIA] = useState(null);
    const [revisandoIA, setRevisandoIA] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const revisionEnCursoRef = useRef(false);
    const pdfUrlRef = useRef(null);

    // ── Carga inicial (una sola petición) ──
    const cargarDocumentos = useCallback(async (silencioso = false) => {
        try {
            if (!silencioso) setLoading(true);
            const params = user?.id_epi ? `?id_epi=${user.id_epi}` : '';
            const res = await api.get(`/documentos${params}`);
            if (Array.isArray(res)) setDocumentos(res.filter(esObservadoODevuelto));
        } catch {
            setMensaje({ tipo: 'error', texto: 'No se pudieron cargar los trámites observados.' });
        } finally {
            if (!silencioso) setLoading(false);
        }
    }, [user?.id_epi]);

    useEffect(() => { void cargarDocumentos(); }, [cargarDocumentos]);

    // Refresco en vivo cuando el Comando mueve un documento de esta EPI
    useEffect(() => {
        const onSync = () => { void cargarDocumentos(true); };
        window.addEventListener('ofbol:sync', onSync);
        return () => window.removeEventListener('ofbol:sync', onSync);
    }, [cargarDocumentos]);

    // Liberar el object URL al desmontar
    useEffect(() => () => { if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current); }, []);

    // ── Derivados (memoizados) ──
    const conteos = useMemo(() => ({
        todos: documentos.length,
        observados: documentos.filter((d) => (d.estado?.nombre || '').toLowerCase().includes('observ')).length,
        devueltos: documentos.filter((d) => (d.estado?.nombre || '').toLowerCase().includes('devuel')).length,
        urgentes: documentos.filter((d) => diasEnBandeja(d) >= 5).length,
    }), [documentos]);

    const filtrados = useMemo(() => {
        const q = filtro.trim().toLowerCase();
        return documentos.filter((d) => {
            const nombreEstado = (d.estado?.nombre || '').toLowerCase();
            if (tab === 'observados' && !nombreEstado.includes('observ')) return false;
            if (tab === 'devueltos' && !nombreEstado.includes('devuel')) return false;
            if (!q) return true;
            const heno = `${d.codigo_documento || ''} ${d.oficial?.nombres || ''} ${d.oficial?.apellidos || ''} ${d.tipo_documento?.nombre || ''} ${d.referencia || ''}`.toLowerCase();
            return heno.includes(q);
        });
    }, [documentos, filtro, tab]);

    // ── Abrir modal ──
    const abrirSubsanacion = async (doc) => {
        setAbierto(true);
        setDetalle(doc);
        setReferencia(doc.referencia || '');
        setNota('');
        setAcepto(false);
        setArchivo(null);
        setHashNuevo(null);
        setRevisionIA(null);
        setVistaPrevia('original');
        if (pdfUrlRef.current) { URL.revokeObjectURL(pdfUrlRef.current); pdfUrlRef.current = null; }
        setPdfUrl(null);
        setCargandoDetalle(true);
        try {
            const completo = await api.get(`/documentos/${doc.id_documento}`);
            if (completo) {
                setDetalle(completo);
                setReferencia(completo.referencia || doc.referencia || '');
            }
        } catch {
            /* se usa el resumen de la lista */
        } finally {
            setCargandoDetalle(false);
        }
    };

    const cerrarModal = useCallback(() => {
        setAbierto(false);
        setDetalle(null);
        if (pdfUrlRef.current) { URL.revokeObjectURL(pdfUrlRef.current); pdfUrlRef.current = null; }
        setPdfUrl(null);
    }, []);

    // ── Revisión IA del PDF corregido (misma que usa Subir Documento) ──
    const ejecutarRevisionIA = useCallback(async (file) => {
        if (!file || revisionEnCursoRef.current) return;
        revisionEnCursoRef.current = true;
        setRevisandoIA(true);
        try {
            const oficial = detalle?.oficial
                ? `${detalle.oficial.nombres || ''} ${detalle.oficial.apellidos || ''}`.trim()
                : '';
            const fd = new FormData();
            fd.append('archivo', file);
            fd.append('tipo_esperado', detalle?.tipo_documento?.nombre || '');
            fd.append('oficial_esperado', oficial);
            const rev = await api.upload('/documentos/revisar-ia', fd);
            setRevisionIA(rev);
        } catch (err) {
            setRevisionIA({ ia_disponible: false, mensaje: err.message || 'No se pudo completar la revisión automática.' });
        } finally {
            revisionEnCursoRef.current = false;
            setRevisandoIA(false);
        }
    }, [detalle]);

    // ── Adjuntar PDF corregido ──
    const seleccionarArchivo = async (file) => {
        if (!file) return;
        const esPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        if (!esPdf) { setMensaje({ tipo: 'error', texto: 'Solo se permiten documentos en formato PDF oficial.' }); return; }
        if (file.size > 15 * 1024 * 1024) { setMensaje({ tipo: 'error', texto: 'El PDF supera el tamaño máximo permitido (15 MB).' }); return; }

        setArchivo(file);
        setRevisionIA(null);
        setVistaPrevia('corregido');
        if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
        const url = URL.createObjectURL(file);
        pdfUrlRef.current = url;
        setPdfUrl(url);

        // Hash SHA-256 en segundo plano (huella institucional del archivo)
        try {
            const buffer = await file.arrayBuffer();
            const digest = await crypto.subtle.digest('SHA-256', buffer);
            setHashNuevo(Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join(''));
        } catch {
            setHashNuevo(null);
        }

        void ejecutarRevisionIA(file);
    };

    // ── Diagnóstico del sistema experto ──
    const diagnostico = useMemo(() => {
        const aprobadas = [];
        const advertencias = [];
        const alertas = [];

        if (referencia.trim().length >= 5) aprobadas.push('Referencia del documento completada.');
        else advertencias.push('La referencia está vacía o es demasiado corta.');

        if (nota.trim().length >= 10) aprobadas.push('Justificación de la corrección registrada.');
        else advertencias.push('Detallá qué corregiste (mínimo 10 caracteres).');

        if (archivo) aprobadas.push(`PDF corregido adjunto: ${archivo.name} (${(archivo.size / 1024).toFixed(1)} KB).`);
        else advertencias.push('No adjuntaste un PDF nuevo: se re-enviará el archivo actual con los metadatos corregidos.');

        if (revisionIA?.ia_disponible === false) {
            advertencias.push(`La verificación con IA no está disponible: ${revisionIA.mensaje || 'servicio desconectado'}. Se aplicó la verificación básica.`);
        } else if (revisionIA) {
            (revisionIA.alertas || []).forEach((a) => alertas.push(a));
            (revisionIA.advertencias || []).forEach((a) => advertencias.push(a));
        }

        return { aprobadas, advertencias, alertas };
    }, [referencia, nota, archivo, revisionIA]);

    // Bloqueo duro: la IA determinó que NO es un memorándum o que el tipo no coincide.
    const bloqueoIA = !!revisionIA && revisionIA.ia_disponible !== false && (
        revisionIA.es_memo === false || revisionIA.coincide_tipo === false
    );

    const puedeEnviar = !enviando && !revisandoIA && !bloqueoIA && acepto
        && referencia.trim().length >= 5 && nota.trim().length >= 10;

    // ── Envío definitivo ──
    const handleSubsanar = async (e) => {
        e.preventDefault();
        if (!detalle || !puedeEnviar) return;

        setEnviando(true);
        try {
            const id = detalle.id_documento;
            let rutaPdf = detalle.ruta_pdf;
            let hashFinal = detalle.hash;
            let subioArchivo = false;

            // 1. Subir el PDF corregido (si lo hay)
            if (archivo) {
                const fd = new FormData();
                fd.append('archivo', archivo);
                const up = await api.upload('/upload-documento', fd);
                if (up?.ruta) { rutaPdf = up.ruta; subioArchivo = true; }
                hashFinal = hashNuevo || detalle.hash;
            }

            // 2. Actualizar el documento y devolverlo a la cola del Comando Dptal.
            //    (solo se envían campos con valor: el backend valida "sometimes|required")
            const payloadDoc = {
                referencia: referencia.trim(),
                estado_actual: ID_ENVIADO_POR_EPI,
                usuario_cambio: user?.id_usuario,
            };
            if (rutaPdf) payloadDoc.ruta_pdf = rutaPdf;
            if (hashFinal) payloadDoc.hash = hashFinal;
            await api.put(`/documentos/${id}`, payloadDoc);

            // 3. Nueva versión → el trámite aparece en la pestaña "Reenviados" del Comando.
            //    Si el documento es anterior al versionado, se reconstruye la v1 con el
            //    archivo original para no dejar un hueco en la trazabilidad.
            const versionesPrevias = detalle.versiones?.length ?? 0;
            if (versionesPrevias === 0 && detalle.ruta_pdf) {
                await api.post('/versiones-documento', {
                    id_documento: id,
                    version: 1,
                    ruta_pdf: detalle.ruta_pdf,
                    subido_por: detalle.id_usuario ?? user?.id_usuario,
                    fecha: detalle.fecha_subida ?? new Date().toISOString(),
                }).catch(() => {});
            }
            const nVersion = versionesPrevias === 0 ? 2 : versionesPrevias + 1;
            await api.post('/versiones-documento', {
                id_documento: id,
                version: nVersion,
                ruta_pdf: rutaPdf,
                subido_por: user?.id_usuario,
                fecha: new Date().toISOString(),
            }).catch(() => {});

            // 4. Hilo de corrección (queda visible en la trazabilidad)
            await api.post('/revisiones', {
                id_documento: id,
                usuario_revisor: user?.id_usuario,
                nivel_revision: 'Secretaría EPI',
                estado: 'Reenviado',
                observacion_libre: `Subsanación y re-envío. ${nota.trim()}${subioArchivo ? ` (Nueva versión ${nVersion} del PDF adjunta).` : ' (Sin cambio de archivo).'}`,
                fecha: new Date().toISOString(),
            }).catch(() => {});

            // 5. Auditoría
            await api.post('/auditorias', {
                id_usuario: user?.id_usuario,
                tabla: 'documentos',
                accion: 'SUBSANACION_REENVIO',
                descripcion: `Subsanación y re-envío del trámite ${detalle.codigo_documento} (versión ${nVersion}). ${nota.trim()}`,
            }).catch(() => {});

            // 6. Notificar a quien observó el trámite (revisores previos)
            const revisores = [...new Set(
                (detalle.revisiones ?? [])
                    .filter((r) => (r.estado || '').toLowerCase() !== 'reenviado')
                    .map((r) => r.usuario_revisor ?? r.revisor?.id_usuario)
                    .filter((v) => v && Number(v) !== Number(user?.id_usuario))
            )];
            await Promise.all(revisores.map((idRev) => api.post('/notificaciones', {
                id_usuario: idRev,
                id_documento: id,
                titulo: `${detalle.codigo_documento} corregido y re-enviado`,
                mensaje: `La ${user?.epi || 'EPI'} subsanó las observaciones y re-envió el trámite. ${nota.trim()}`,
                leido: false,
                fecha: new Date().toISOString(),
            }).catch(() => {})));

            // 7. Aviso en vivo al Comando
            await api.get('/sync/ping').catch(() => {});
            window.dispatchEvent(new CustomEvent('ofbol:sync', { detail: { local: true, documento: detalle.codigo_documento } }));

            mostrarToast({
                tipo: 'success',
                titulo: 'Trámite corregido y re-enviado',
                detalle: `${detalle.codigo_documento} volvió a la cola del Comando Departamental.`,
            });
            setMensaje({ tipo: 'success', texto: `El trámite ${detalle.codigo_documento} fue corregido y re-enviado al Comando Departamental.` });
            cerrarModal();
            void cargarDocumentos(true);
        } catch (err) {
            setMensaje({ tipo: 'error', texto: err.message || 'Error al enviar la corrección. Intente nuevamente.' });
        } finally {
            setEnviando(false);
        }
    };

    const urlOriginal = detalle?.ruta_pdf ? `/storage/${detalle.ruta_pdf}` : null;
    const urlPrevia = (vistaPrevia === 'corregido' && pdfUrl) ? pdfUrl : urlOriginal;
    const ultimaObs = detalle?.revisiones?.length
        ? [...detalle.revisiones].reverse().find((r) => (r.estado || '').toLowerCase() !== 'reenviado')
        : null;

    // El checklist del sistema experto se ordena por urgencia: lo que falta
    // resolver arriba, lo que ya pasó plegado. Se calcula acá para no repetir la
    // expresión en tres lugares del JSX.
    const hayObservaciones = diagnostico.alertas.length + diagnostico.advertencias.length > 0;

    return (
        <LayoutSecretario>
            <div className="p-6 max-w-7xl mx-auto space-y-6 ofbol-page-enter">
                {/* ── Encabezado ── */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-5">
                    <div className="min-w-0">
                        <h1 className="ofbol-display heading-balance">
                            Bandeja de correcciones y re-envío
                        </h1>
                        <p className="ofbol-nota mt-2">
                            Trámites devueltos por el Comando Departamental de La Paz. Corregí las
                            observaciones, verificá el PDF con la IA y reenviá el documento como nueva versión.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="ofbol-badge ofbol-badge--crimson">Subsanación obligatoria</span>
                        <button
                            type="button"
                            onClick={() => void cargarDocumentos()}
                            className="ofbol-btn-ghost"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                            Actualizar
                        </button>
                    </div>
                </div>

                {mensaje && <Alert type={mensaje.tipo} onClose={() => setMensaje(null)}>{mensaje.texto}</Alert>}

                {/* ── Resumen ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 ofbol-stagger">
                    <KpiPanel etiqueta="En bandeja" valor={conteos.todos} acento={ACENTOS.oliva} icono={<FileText size={15} strokeWidth={1.9} />} />
                    <KpiPanel etiqueta="Observados" valor={conteos.observados} acento={ACENTOS.ambar} icono={<AlertTriangle size={15} strokeWidth={1.9} />} />
                    <KpiPanel etiqueta="Devueltos" valor={conteos.devueltos} acento={ACENTOS.crimson} icono={<X size={15} strokeWidth={1.9} />} />
                    <KpiPanel etiqueta="Con 5+ días" valor={conteos.urgentes} acento={ACENTOS.crimson} icono={<Clock size={15} strokeWidth={1.9} />} />
                </div>

                {/* ── Filtros ── */}
                <div className="ofbol-card p-3 flex flex-col sm:flex-row gap-3">
                    <div className="ofbol-card p-1 flex gap-1 sm:max-w-md">
                        {[
                            { id: 'todos', label: `Todos (${conteos.todos})` },
                            { id: 'observados', label: `Observados (${conteos.observados})` },
                            { id: 'devueltos', label: `Devueltos (${conteos.devueltos})` },
                        ].map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTab(t.id)}
                                className="flex-1 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide transition-colors"
                                style={tab === t.id
                                    ? { background: '#3d4a2c', color: 'white' }
                                    : { color: '#5a615f' }}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <div className="relative flex-1">
                        <input
                            type="text"
                            aria-label="Buscar por código, oficial o tipo de trámite"
                            placeholder="Buscar por código, oficial o tipo de trámite…"
                            value={filtro}
                            onChange={(e) => setFiltro(e.target.value)}
                            className="ofbol-input w-full !py-2 !text-xs"
                        />
                    </div>
                </div>

                {/* ── Lista ── */}
                {loading ? (
                    <div className="py-16 flex justify-center"><Spinner /></div>
                ) : filtrados.length === 0 ? (
                    <div className="ofbol-card p-6">
                        <EstadoVacio
                            icono={CheckCircle2}
                            titulo="Sin trámites pendientes de subsanación"
                            nota="Tu unidad policial no tiene documentos observados ni devueltos en este momento."
                        />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 ofbol-stagger">
                        {filtrados.map((doc) => {
                            const dias = diasEnBandeja(doc);
                            const devuelto = (doc.estado?.nombre || '').toLowerCase().includes('devuel');
                            const ultimaRev = doc.revisiones?.length
                                ? [...doc.revisiones].reverse().find((r) => r.estado && r.estado !== 'Reenviado')
                                : null;
                            return (
                                <article key={doc.id_documento} className="ofbol-card p-5 flex flex-col gap-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
                                                {doc.codigo_documento}
                                            </span>
                                            <h3 className="text-sm font-bold text-slate-900 mt-2">
                                                {doc.tipo_documento?.nombre || 'Documento policial'}
                                            </h3>
                                            <p className="text-xs text-slate-600 font-medium mt-0.5">
                                                {doc.oficial?.grado?.nombre || 'Of.'}{' '}
                                                <span className="text-slate-900 font-semibold">
                                                    {doc.oficial?.nombres} {doc.oficial?.apellidos}
                                                </span>
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                                            <EstadoBadge nombre={doc.estado?.nombre || 'Observado'} />
                                            {dias >= 1 && (
                                                <span
                                                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border"
                                                    style={dias >= 5
                                                        ? { background: 'rgba(143,32,32,0.08)', color: '#8f2020', borderColor: 'rgba(143,32,32,0.25)' }
                                                        : { background: 'rgba(90,97,95,0.08)', color: '#5a615f', borderColor: 'rgba(90,97,95,0.2)' }}
                                                    title="Días en bandeja desde la observación"
                                                >
                                                    <Clock size={10} /> {dias} día{dias === 1 ? '' : 's'}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Observación vigente */}
                                    <div
                                        className="rounded-[14px] px-3.5 py-3 border"
                                        style={devuelto
                                            ? { background: 'rgba(143,32,32,0.05)', borderColor: 'rgba(143,32,32,0.22)' }
                                            : { background: 'rgba(154,111,10,0.07)', borderColor: 'rgba(154,111,10,0.28)' }}
                                    >
                                        <p className="text-[10px] font-black uppercase tracking-[0.12em] flex items-center gap-1.5"
                                            style={{ color: devuelto ? '#8f2020' : '#7f5a07' }}>
                                            <AlertTriangle size={11} /> Motivo {ultimaRev?.estado || 'de la observación'}
                                        </p>
                                        <p className="text-xs text-slate-800 font-medium mt-1 leading-relaxed">
                                            {ultimaRev?.tipo_observacion?.nombre ? `${ultimaRev.tipo_observacion.nombre}: ` : ''}
                                            {ultimaRev?.observacion_libre || 'Revise los requisitos de forma y firma institucional.'}
                                        </p>
                                        <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-2 flex-wrap">
                                            <History size={10} />
                                            {ultimaRev?.revisor?.usuario ? `Dictaminado por ${ultimaRev.revisor.usuario}` : 'Comando Departamental La Paz'}
                                            {ultimaRev?.fecha && <span>· {fechaCorta(ultimaRev.fecha)}</span>}
                                            {(doc.revisiones?.length ?? 0) > 1 && (
                                                <span className="font-bold">· {doc.revisiones.length} observaciones en el hilo</span>
                                            )}
                                        </p>
                                    </div>

                                    <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                                        <span className="text-[10px] text-slate-400 font-medium truncate">
                                            Ref: {doc.referencia}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => void abrirSubsanacion(doc)}
                                            className="ofbol-btn-primary !py-2 !px-4 !text-[11px] shrink-0 ofbol-sheen"
                                        >
                                            <Send size={13} />
                                            Subsanar y re-enviar
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ══════════════ MODAL DE SUBSANACIÓN ══════════════ */}
            {abierto && detalle && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/65 backdrop-blur-xs"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="modal-subsanar-title"
                    onKeyDown={(e) => { if (e.key === 'Escape' && !enviando) cerrarModal(); }}
                >
                    <div className="ofbol-elevated rounded-[14px] w-full max-w-6xl overflow-hidden ofbol-animate-slide-up flex flex-col max-h-[94vh]">
                        {/* Cabecera */}
                        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-100 shrink-0">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 id="modal-subsanar-title" className="text-base font-black text-slate-900">
                                        Subsanar trámite
                                    </h3>
                                    <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                                        {detalle.codigo_documento}
                                    </span>
                                </div>
                                <div className="mt-1.5">
                                    <ChipsDato datos={[
                                        { etiqueta: 'Tipo', valor: detalle.tipo_documento?.nombre || 'Documento' },
                                        { etiqueta: 'Oficial', valor: `${detalle.oficial?.nombres || ''} ${detalle.oficial?.apellidos || ''}`.trim() || '—' },
                                        { etiqueta: 'Versión', valor: detalle.versiones?.length ?? 1 },
                                    ]} />
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={cerrarModal}
                                disabled={enviando}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                                aria-label="Cerrar"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Cuerpo */}
                        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] flex-1 min-h-0">
                            {/* ── Vista previa ── */}
                            <div className="flex flex-col border-b lg:border-b-0 lg:border-r border-slate-100 min-h-0">
                                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
                                    <Eye size={13} className="text-slate-400" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                                        Vista previa
                                    </span>
                                    {pdfUrl && (
                                        <div className="ml-auto flex gap-1 p-0.5 bg-slate-100 rounded-lg">
                                            {[
                                                { id: 'original', label: 'Original' },
                                                { id: 'corregido', label: 'Corregido' },
                                            ].map((v) => (
                                                <button
                                                    key={v.id}
                                                    type="button"
                                                    onClick={() => setVistaPrevia(v.id)}
                                                    className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wide transition-colors"
                                                    style={vistaPrevia === v.id ? { background: 'white', color: '#0a0f0d' } : { color: '#5a615f' }}
                                                >
                                                    {v.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-h-[280px] bg-slate-100">
                                    {cargandoDetalle ? (
                                        <div className="h-full flex items-center justify-center"><Spinner /></div>
                                    ) : urlPrevia ? (
                                        <iframe
                                            key={urlPrevia}
                                            src={urlPrevia}
                                            title="Vista previa del documento"
                                            className="w-full h-full min-h-[320px]"
                                        />
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 p-6 text-center">
                                            <FileText size={26} />
                                            <p className="text-xs font-bold">No hay PDF disponible para previsualizar.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ── Formulario ── */}
                            <form onSubmit={handleSubsanar} className="flex flex-col min-h-0">
                                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                                    {/* Observación vigente */}
                                    {ultimaObs && (
                                        <div className="rounded-[14px] px-3.5 py-3 bg-rose-50 border border-rose-200">
                                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-rose-700 flex items-center gap-1.5">
                                                <AlertTriangle size={11} /> Corrección requerida
                                            </p>
                                            <p className="text-xs text-rose-950 font-medium mt-1 leading-relaxed">
                                                {ultimaObs.tipo_observacion?.nombre ? `${ultimaObs.tipo_observacion.nombre}: ` : ''}
                                                {ultimaObs.observacion_libre || 'Revise los requisitos observados.'}
                                            </p>
                                        </div>
                                    )}

                                    {/* Referencia */}
                                    <div>
                                        <label htmlFor="ref-subsanar" className="block text-[11px] font-black uppercase tracking-[0.08em] text-slate-500 mb-1.5">
                                            Referencia del documento
                                        </label>
                                        <input
                                            id="ref-subsanar"
                                            type="text"
                                            required
                                            value={referencia}
                                            onChange={(e) => setReferencia(e.target.value)}
                                            className="ofbol-input w-full !py-2 !text-xs"
                                        />
                                    </div>

                                    {/* PDF corregido */}
                                    <div>
                                        <label className="block text-[11px] font-black uppercase tracking-[0.08em] text-slate-500 mb-1.5">
                                            PDF corregido {archivo ? '(nuevo)' : '(opcional)'}
                                        </label>
                                        <label
                                            className="flex items-center gap-3 px-4 py-3 rounded-[14px] border-2 border-dashed cursor-pointer transition-colors"
                                            style={archivo
                                                ? { borderColor: 'rgba(26,92,82,0.4)', background: 'rgba(26,92,82,0.05)' }
                                                : { borderColor: '#e2e0db', background: '#faf9f6' }}
                                        >
                                            <Upload size={16} className="text-slate-400 shrink-0" />
                                            <span className="text-xs font-semibold text-slate-600 truncate">
                                                {archivo ? `${archivo.name} · ${(archivo.size / 1024).toFixed(1)} KB` : 'Adjuntar la versión corregida (PDF)'}
                                            </span>
                                            <input
                                                type="file"
                                                accept="application/pdf,.pdf"
                                                className="hidden"
                                                onChange={(e) => void seleccionarArchivo(e.target.files?.[0])}
                                            />
                                        </label>
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            Si no cambiás el archivo, se re-envía con los metadatos corregidos y se registra la justificación.
                                        </p>
                                    </div>

                                    {/* Revisión IA */}
                                    {archivo && (
                                        <div className="rounded-[14px] border border-slate-200 overflow-hidden">
                                            <div className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-50 border-b border-slate-200">
                                                <Sparkles size={13} className="text-[#3d4a2c]" />
                                                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
                                                    Revisión con IA antes de re-enviar
                                                </span>
                                                {revisandoIA && <Loader2 size={12} className="animate-spin text-slate-400 ml-auto" />}
                                                {!revisandoIA && revisionIA?.ia_disponible !== false && revisionIA && (
                                                    <button
                                                        type="button"
                                                        onClick={() => void ejecutarRevisionIA(archivo)}
                                                        className="ml-auto text-[10px] font-black uppercase text-[#3d4a2c] hover:underline"
                                                    >
                                                        Reintentar
                                                    </button>
                                                )}
                                            </div>
                                            <div className="p-3.5 space-y-2">
                                                {revisandoIA ? (
                                                    <p className="text-xs text-slate-500">Analizando el PDF corregido…</p>
                                                ) : !revisionIA ? (
                                                    <p className="text-xs text-slate-500">Esperando el análisis del archivo…</p>
                                                ) : revisionIA.ia_disponible === false ? (
                                                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                                                        {revisionIA.mensaje}
                                                    </p>
                                                ) : (
                                                    <>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            <MiniChip ok={revisionIA.es_memo} label={revisionIA.es_memo ? 'Es memorándum' : 'No es memorándum'} />
                                                            <MiniChip ok={revisionIA.coincide_tipo !== false} label={`Tipo: ${revisionIA.tipo_detectado || 'no detectado'}`} />
                                                            <MiniChip ok={revisionIA.firma} label={revisionIA.firma ? 'Firma' : 'Sin firma'} />
                                                            <MiniChip ok={revisionIA.sello} label={revisionIA.sello ? 'Sello' : 'Sin sello'} />
                                                            {revisionIA.coincide_oficial !== null && revisionIA.coincide_oficial !== undefined && (
                                                                <MiniChip ok={revisionIA.coincide_oficial} label={revisionIA.coincide_oficial ? 'Destinatario coincide' : 'Destinatario distinto'} />
                                                            )}
                                                        </div>
                                                        {revisionIA.resumen && (
                                                            <p className="text-xs text-slate-600 italic leading-relaxed">“{revisionIA.resumen}”</p>
                                                        )}
                                                        <p className="text-[10px] text-slate-400">Analizado en {revisionIA.tiempo_seg ?? '—'} s</p>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Checklist — lo que falta resolver primero; las
                                        verificaciones superadas quedan plegadas para no
                                        competir con las advertencias. */}
                                    <div className="space-y-2">
                                        {diagnostico.alertas.map((a, i) => (
                                            <FilaCheck key={`al-${i}`} tipo="alerta" texto={a} />
                                        ))}
                                        {diagnostico.advertencias.map((a, i) => (
                                            <FilaCheck key={`ad-${i}`} tipo="aviso" texto={a} />
                                        ))}

                                        {diagnostico.aprobadas.length > 0 && (
                                            hayObservaciones ? (
                                                <details>
                                                    <summary className="cursor-pointer list-none text-[10px] font-bold text-slate-400 hover:text-slate-700">
                                                        Ver las {diagnostico.aprobadas.length} verificaciones superadas
                                                    </summary>
                                                    <div className="mt-2 space-y-2">
                                                        {diagnostico.aprobadas.map((a, i) => (
                                                            <FilaCheck key={`ok-${i}`} tipo="ok" texto={a} />
                                                        ))}
                                                    </div>
                                                </details>
                                            ) : (
                                                diagnostico.aprobadas.map((a, i) => (
                                                    <FilaCheck key={`ok-${i}`} tipo="ok" texto={a} />
                                                ))
                                            )
                                        )}
                                    </div>

                                    {/* Nota */}
                                    <div>
                                        <label htmlFor="nota-subsanar" className="block text-[11px] font-black uppercase tracking-[0.08em] text-slate-500 mb-1.5">
                                            Justificación de la corrección *
                                        </label>
                                        <textarea
                                            id="nota-subsanar"
                                            rows={3}
                                            required
                                            minLength={10}
                                            placeholder="Detallá qué corregiste conforme al requerimiento del revisor…"
                                            value={nota}
                                            onChange={(e) => setNota(e.target.value)}
                                            className="ofbol-input w-full !text-xs"
                                        />
                                    </div>

                                    {/* Confirmación */}
                                    <label className="flex items-start gap-2.5 p-3 rounded-[14px] border border-slate-200 bg-slate-50 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={acepto}
                                            onChange={(e) => setAcepto(e.target.checked)}
                                            className="mt-0.5 w-4 h-4 rounded accent-[#3d4a2c]"
                                        />
                                        <span className="text-[11px] text-slate-700 leading-snug">
                                            Confirmo que las correcciones son fieles al requerimiento y asumo la
                                            responsabilidad del re-envío de <strong>{detalle.codigo_documento}</strong>.
                                        </span>
                                    </label>
                                </div>

                                {/* Pie */}
                                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0 bg-white">
                                    <button
                                        type="button"
                                        onClick={cerrarModal}
                                        disabled={enviando}
                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold disabled:opacity-40"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!puedeEnviar}
                                        title={bloqueoIA ? 'La IA detectó que el documento no corresponde; corregilo antes de re-enviar.' : undefined}
                                        className="ofbol-btn-primary !py-2.5 !px-5 !text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {enviando ? (
                                            <><Spinner size="sm" /> Re-enviando…</>
                                        ) : revisandoIA ? (
                                            <><Loader2 size={14} className="animate-spin" /> Revisando…</>
                                        ) : (
                                            <><ShieldCheck size={14} /> Confirmar y re-enviar</>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </LayoutSecretario>
    );
}

/* ── Piezas auxiliares ── */

function MiniChip({ ok, label }) {
    return (
        <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border"
            style={ok
                ? { background: 'rgba(26,92,82,0.08)', color: '#1a5c52', borderColor: 'rgba(26,92,82,0.25)' }
                : { background: 'rgba(143,32,32,0.07)', color: '#8f2020', borderColor: 'rgba(143,32,32,0.22)' }}
        >
            {ok ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
            {label}
        </span>
    );
}

function FilaCheck({ tipo, texto }) {
    const estilos = {
        ok: { bg: 'rgba(26,92,82,0.06)', borde: 'rgba(26,92,82,0.2)', color: '#1a5c52', icono: <CheckCircle2 size={12} /> },
        aviso: { bg: 'rgba(154,111,10,0.08)', borde: 'rgba(154,111,10,0.28)', color: '#7f5a07', icono: <AlertTriangle size={12} /> },
        alerta: { bg: 'rgba(143,32,32,0.07)', borde: 'rgba(143,32,32,0.25)', color: '#8f2020', icono: <AlertTriangle size={12} /> },
    }[tipo] ?? {};

    return (
        <div
            className="flex items-start gap-2 rounded-xl border px-3 py-2"
            style={{ background: estilos.bg, borderColor: estilos.borde }}
        >
            <span className="shrink-0 mt-0.5" style={{ color: estilos.color }}>{estilos.icono}</span>
            <span className="text-[11px] font-medium leading-snug" style={{ color: estilos.color }}>{texto}</span>
        </div>
    );
}
