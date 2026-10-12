/**
 * GestionTiposMemo.jsx — Catálogo de Tipos de Memorándum (Comando General)
 *
 * Permite ver los tipos de memorándum MÁS USADOS y administrar el catálogo
 * institucional: cada tipo define un patrón (secciones y campos) y sus
 * validaciones, guardados en la tabla `tipos_memo`.
 *
 * Protecciones de seguridad:
 *   · Crear/editar exige una confirmación explícita (modal con resumen).
 *   · Eliminar exige escribir el NOMBRE EXACTO del tipo.
 *   · El backend rechaza eliminar tipos con documentos registrados.
 *   · Toda operación queda en la auditoría institucional.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import LayoutComandoGeneral from '../../js/components/LayoutComandoGeneral';
import Spinner from '../../js/components/ui/Spinner';
import Alert from '../../js/components/ui/Alert';
import api from '../../js/lib/api';
import { useAuth } from '../../js/context/AuthContext';
import {
    FileText, Plus, Pencil, Trash2, ShieldCheck, Sparkles, X,
    Layers, ListChecks, TrendingUp, AlertTriangle, CheckCircle2, Loader2, Eye,
} from 'lucide-react';

const CATEGORIAS = ['Personal', 'Disciplinario', 'Administrativo', 'Operativo', 'Reconocimiento', 'Otro'];
const PALETA = ['#3d4a2c', '#9a6f0a', '#1a5c52', '#8b4513', '#8f2020', '#495456'];

const slugify = (s) => (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);

const formInicial = () => ({
    id_tipo: '',
    nombre: '',
    codigo: '',
    categoria: 'Personal',
    descripcion: '',
    color: PALETA[0],
    activo: true,
    secciones: [{ titulo: '', camposTexto: '' }],
    pie: '',
    campos_requeridos: [],
    longitud_minima: 0,
    palabras_clave_texto: '',
    requiere_firma: true,
    requiere_sello: true,
});

export default function GestionTiposMemo() {
    const { user } = useAuth();
    const [data, setData] = useState({ memos: [], mas_usados: [], sugerencias: [], tipos_documento: [] });
    const [loading, setLoading] = useState(true);
    const [mensaje, setMensaje] = useState(null);
    const [guardando, setGuardando] = useState(false);

    const [modal, setModal] = useState(null); // { modo:'crear'|'editar', id?, nombreOriginal? }
    const [form, setForm] = useState(formInicial());
    const [confirmar, setConfirmar] = useState(null); // { accion:'guardar'|'eliminar', memo?, acepto, texto }

    const cargar = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/tipos-memo');
            // Respuesta defensiva: ante un servicio que no devuelva el objeto
            // esperado, la vista conserva su catálogo vacío en vez de romperse.
            if (res && !Array.isArray(res) && typeof res === 'object') {
                setData((previo) => ({ ...previo, ...res }));
            }
        } catch {
            setMensaje({ tipo: 'error', texto: 'No se pudo cargar el catálogo de tipos de memorándum.' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void cargar(); }, [cargar]);

    const {
        memos = [],
        mas_usados: masUsados = [],
        sugerencias = [],
        tipos_documento: tiposDocumento = [],
    } = data ?? {};

    const kpis = useMemo(() => {
        const total = memos.length;
        const activos = memos.filter((m) => m.activo).length;
        const masUsado = [...memos].sort((a, b) => (b.usos ?? 0) - (a.usos ?? 0))[0];
        return { total, activos, sinUso: memos.filter((m) => !m.usos).length, masUsado };
    }, [memos]);

    const totalRegistros = masUsados.reduce((a, t) => a + t.total, 0) || 1;

    /* ── Apertura de modales ── */

    const abrirCrear = (sugerencia = null) => {
        const base = formInicial();
        if (sugerencia) {
            base.nombre = sugerencia.tipo;
            base.codigo = slugify(sugerencia.tipo);
            base.id_tipo = sugerencia.id_tipo;
        }
        setForm(base);
        setModal({ modo: 'crear' });
    };

    const abrirEditar = (memo) => {
        const formato = memo.formato ?? {};
        const val = memo.validaciones ?? {};
        setForm({
            id_tipo: memo.id_tipo ?? '',
            nombre: memo.nombre ?? '',
            codigo: memo.codigo ?? '',
            categoria: memo.categoria ?? 'Otro',
            descripcion: memo.descripcion ?? '',
            color: memo.color ?? PALETA[0],
            activo: !!memo.activo,
            secciones: (formato.secciones?.length ? formato.secciones : [{ titulo: '', campos: [] }]).map((s) => ({
                titulo: s.titulo ?? '',
                camposTexto: (s.campos ?? []).join(', '),
            })),
            pie: formato.pie ?? '',
            campos_requeridos: val.campos_requeridos ?? [],
            longitud_minima: val.longitud_minima ?? 0,
            palabras_clave_texto: (val.palabras_clave ?? []).join(', '),
            requiere_firma: val.requiere_firma ?? true,
            requiere_sello: val.requiere_sello ?? true,
        });
        setModal({ modo: 'editar', id: memo.id_memo, nombreOriginal: memo.nombre });
    };

    /* ── Formato: secciones dinámicas ── */

    const setSeccion = (i, cambio) => setForm((f) => ({
        ...f,
        secciones: f.secciones.map((s, idx) => (idx === i ? { ...s, ...cambio } : s)),
    }));
    const addSeccion = () => setForm((f) => ({ ...f, secciones: [...f.secciones, { titulo: '', camposTexto: '' }] }));
    const delSeccion = (i) => setForm((f) => ({ ...f, secciones: f.secciones.filter((_, idx) => idx !== i) }));

    // Campos disponibles derivados de las secciones (para los checkboxes de requeridos)
    const camposDisponibles = useMemo(() => {
        const set = new Set();
        form.secciones.forEach((s) => {
            s.camposTexto.split(',').map((c) => c.trim()).filter(Boolean).forEach((c) => set.add(c));
        });
        return [...set];
    }, [form.secciones]);

    const toggleRequerido = (campo) => setForm((f) => ({
        ...f,
        campos_requeridos: f.campos_requeridos.includes(campo)
            ? f.campos_requeridos.filter((c) => c !== campo)
            : [...f.campos_requeridos, campo],
    }));

    /* ── Construcción del payload (mismo patrón para crear y editar) ── */

    const construirPayload = () => {
        const secciones = form.secciones
            .map((s) => ({
                titulo: s.titulo.trim(),
                campos: s.camposTexto.split(',').map((c) => c.trim()).filter(Boolean),
            }))
            .filter((s) => s.titulo !== '');

        const palabras = form.palabras_clave_texto.split(',').map((p) => p.trim()).filter(Boolean);

        return {
            id_usuario: user?.id_usuario,
            id_tipo: form.id_tipo === '' ? null : Number(form.id_tipo),
            nombre: form.nombre.trim(),
            codigo: (form.codigo.trim() || slugify(form.nombre)),
            categoria: form.categoria || null,
            descripcion: form.descripcion.trim() || null,
            color: form.color,
            activo: form.activo,
            formato: { secciones, pie: form.pie.trim() || null },
            validaciones: {
                campos_requeridos: form.campos_requeridos,
                longitud_minima: Number(form.longitud_minima) || 0,
                palabras_clave: palabras,
                requiere_firma: form.requiere_firma,
                requiere_sello: form.requiere_sello,
            },
        };
    };

    const validarForm = () => {
        if (!form.nombre.trim()) return 'El nombre del tipo de memorándum es obligatorio.';
        const codigo = form.codigo.trim() || slugify(form.nombre);
        if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(codigo)) {
            return 'El código solo admite mayúsculas, números, guiones y guiones bajos.';
        }
        if (form.secciones.filter((s) => s.titulo.trim()).length === 0) {
            return 'Definí al menos una sección del formato.';
        }
        return null;
    };

    /* ── Guardar (con confirmación previa) ── */

    const pedirConfirmacionGuardar = (e) => {
        e.preventDefault();
        const error = validarForm();
        if (error) { setMensaje({ tipo: 'error', texto: error }); return; }
        setConfirmar({ accion: 'guardar', acepto: false });
    };

    const guardar = async () => {
        setGuardando(true);
        try {
            const payload = construirPayload();
            if (modal?.modo === 'editar') {
                await api.put(`/tipos-memo/${modal.id}`, payload);
                setMensaje({ tipo: 'success', texto: `Tipo de memorándum "${payload.nombre}" actualizado correctamente.` });
            } else {
                await api.post('/tipos-memo', payload);
                setMensaje({ tipo: 'success', texto: `Tipo de memorándum "${payload.nombre}" creado correctamente.` });
            }
            setConfirmar(null);
            setModal(null);
            await cargar();
        } catch (err) {
            const detalle = err.errors ? Object.values(err.errors).flat().join(' ') : err.message;
            setMensaje({ tipo: 'error', texto: detalle || 'No se pudo guardar el tipo de memorándum.' });
            setConfirmar(null);
        } finally {
            setGuardando(false);
        }
    };

    /* ── Eliminar (confirmación por nombre exacto) ── */

    const pedirConfirmacionEliminar = (memo) => setConfirmar({ accion: 'eliminar', memo, texto: '' });

    const eliminar = async () => {
        setGuardando(true);
        try {
            await api.delete(`/tipos-memo/${confirmar.memo.id_memo}`, {
                id_usuario: user?.id_usuario,
                confirmacion: confirmar.texto.trim(),
            });
            setMensaje({ tipo: 'success', texto: `Tipo de memorándum "${confirmar.memo.nombre}" eliminado.` });
            setConfirmar(null);
            await cargar();
        } catch (err) {
            setMensaje({ tipo: 'error', texto: err.message || 'No se pudo eliminar el tipo de memorándum.' });
            setConfirmar(null);
        } finally {
            setGuardando(false);
        }
    };

    const resetForm = () => { setModal(null); setForm(formInicial()); };

    return (
        <LayoutComandoGeneral>
            <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 ofbol-page-enter">
                {/* ── Encabezado ── */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <h1 className="ofbol-display">Tipos de memorándum y formatos</h1>
                        <p className="ofbol-nota mt-2">
                            Patrón, formato y validaciones de cada tipo de memorándum institucional. Solo el Comando
                            General administra este catálogo.
                        </p>
                    </div>
                    <button type="button" onClick={() => abrirCrear()} className="ofbol-btn-primary !py-2.5 !px-4 shrink-0">
                        <Plus size={15} /> Nuevo tipo de memorándum
                    </button>
                </div>

                {mensaje && <Alert type={mensaje.tipo} onClose={() => setMensaje(null)}>{mensaje.texto}</Alert>}

                {loading ? (
                    <div className="py-20 flex justify-center"><Spinner /></div>
                ) : (
                    <>
                        {/* ── KPIs ── */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 ofbol-stagger">
                            <Kpi etiqueta="Tipos definidos" valor={kpis.total} icon={<Layers size={14} />} acento="#3d4a2c" />
                            <Kpi etiqueta="Activos" valor={kpis.activos} icon={<CheckCircle2 size={14} />} acento="#1a5c52" />
                            <Kpi etiqueta="Sin uso" valor={kpis.sinUso} icon={<AlertTriangle size={14} />} acento="#9a6f0a" />
                            <Kpi
                                etiqueta="Más usado"
                                valor={kpis.masUsado?.usos ?? 0}
                                sub={kpis.masUsado?.nombre}
                                icon={<TrendingUp size={14} />}
                                acento="#8f2020"
                            />
                        </div>

                        {/* ── Tipos más usados ── */}
                        <section className="ofbol-card p-6 space-y-4">
                            <header className="flex items-center gap-2">
                                <TrendingUp size={14} className="text-[#3d4a2c]" />
                                <h2 className="text-[13px] font-black uppercase tracking-[0.06em] text-[#0a0f0d]">
                                    Tipos de memorándum más usados
                                </h2>
                            </header>
                            {masUsados.length === 0 ? (
                                <p className="text-xs text-slate-400 py-3 text-center">Todavía no hay documentos registrados.</p>
                            ) : (
                                <div className="space-y-3">
                                    {masUsados.map((t, i) => (
                                        <div key={t.id_tipo} className="flex items-center gap-3">
                                            <span
                                                className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 tabular-nums"
                                                style={{ background: 'rgba(61,74,44,0.08)', color: PALETA[i % PALETA.length] }}
                                            >
                                                {i + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-baseline gap-2">
                                                    <span className="text-[12px] font-bold text-[#3f4849] truncate">{t.tipo}</span>
                                                    <span className="text-[12px] font-black tabular-nums text-[#0a0f0d] shrink-0">
                                                        {t.total}
                                                        <span className="text-slate-400 font-bold"> · {((t.total / totalRegistros) * 100).toFixed(1)}%</span>
                                                    </span>
                                                </div>
                                                <div className="ofbol-progress mt-1">
                                                    <div className="ofbol-progress-bar" style={{ width: `${Math.max((t.total / masUsados[0].total) * 100, 4)}%`, background: PALETA[i % PALETA.length] }} />
                                                </div>
                                            </div>
                                            {t.definido ? (
                                                <span className="ofbol-badge ofbol-badge--olive shrink-0">definido</span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => abrirCrear(t)}
                                                    className="shrink-0 text-[10px] font-black uppercase tracking-wide text-[#7f5a07] hover:underline"
                                                >
                                                    Definir formato
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {sugerencias.length > 0 && (
                                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                                    <strong>{sugerencias.length}</strong> tipo(s) ya se usan en el registro pero no tienen formato definido.
                                    Definilos para estandarizar su patrón y validaciones.
                                </p>
                            )}
                        </section>

                        {/* ── Catálogo ── */}
                        {memos.length === 0 ? (
                            <div className="ofbol-card p-14 text-center">
                                <FileText size={26} className="mx-auto text-[#c1c9a6]" />
                                <h3 className="text-sm font-black text-slate-700 mt-3">Sin tipos de memorándum definidos</h3>
                                <p className="text-xs text-slate-500 mt-1">Creá el primero siguiendo el patrón institucional.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 ofbol-stagger">
                                {memos.map((m) => (
                                    <article key={m.id_memo} className="ofbol-card p-5 flex flex-col gap-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: m.color }} />
                                                    <h3 className="text-sm font-black text-[#0a0f0d] truncate">{m.nombre}</h3>
                                                    {!m.activo && (
                                                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">inactivo</span>
                                                    )}
                                                </div>
                                                <p className="font-mono text-[10px] text-slate-400 mt-1">
                                                    {m.codigo}
                                                    {m.categoria ? ` · ${m.categoria}` : ''}
                                                    {m.tipo_documento?.nombre ? ` · vinculado a "${m.tipo_documento.nombre}"` : ''}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => abrirEditar(m)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-[#3d4a2c] hover:bg-[#3d4a2c]/8"
                                                    aria-label={`Editar ${m.nombre}`}
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => pedirConfirmacionEliminar(m)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-[#8f2020] hover:bg-red-50"
                                                    aria-label={`Eliminar ${m.nombre}`}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {m.descripcion && <p className="text-[11px] text-slate-600 leading-relaxed">{m.descripcion}</p>}

                                        {/* Patrón del formato */}
                                        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-1.5">
                                            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400 flex items-center gap-1">
                                                <Layers size={10} /> Patrón del formato
                                            </p>
                                            {(m.formato?.secciones ?? []).length === 0 ? (
                                                <p className="text-[11px] text-slate-400">Sin secciones definidas.</p>
                                            ) : (
                                                m.formato.secciones.map((s, i) => (
                                                    <p key={i} className="text-[11px] text-slate-700">
                                                        <span className="font-bold">{i + 1}. {s.titulo}</span>
                                                        {(s.campos ?? []).length > 0 && (
                                                            <span className="text-slate-500"> — {(s.campos ?? []).join(' · ')}</span>
                                                        )}
                                                    </p>
                                                ))
                                            )}
                                        </div>

                                        <div className="flex flex-wrap gap-1.5">
                                            <Chip mini icon={<ListChecks size={10} />} texto={`${m.validaciones?.campos_requeridos?.length ?? 0} campos requeridos`} />
                                            {(m.validaciones?.longitud_minima ?? 0) > 0 && <Chip mini texto={`mín. ${m.validaciones.longitud_minima} caracteres`} />}
                                            {(m.validaciones?.palabras_clave?.length ?? 0) > 0 && <Chip mini texto={`${m.validaciones.palabras_clave.length} palabras clave`} />}
                                            {m.validaciones?.requiere_firma && <Chip mini icon={<ShieldCheck size={10} />} texto="exige firma" />}
                                            {m.validaciones?.requiere_sello && <Chip mini icon={<ShieldCheck size={10} />} texto="exige sello" />}
                                        </div>

                                        <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
                                            <span className="text-[10px] text-slate-400 font-medium">Uso registrado</span>
                                            <span className="ofbol-badge ofbol-badge--olive tabular-nums">{m.usos ?? 0} documentos</span>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* ══════════ MODAL CREAR / EDITAR ══════════ */}
                {modal && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/65 backdrop-blur-xs"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="modal-memo-title"
                        onKeyDown={(e) => { if (e.key === 'Escape') resetForm(); }}
                    >
                        <div className="bg-white rounded-[14px] w-full max-w-3xl border border-slate-200 flex flex-col max-h-[92vh] ofbol-animate-slide-up">
                            <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-100 shrink-0">
                                <div>
                                    <h3 id="modal-memo-title" className="text-base font-black text-slate-900">
                                        {modal.modo === 'editar' ? 'Editar tipo de memorándum' : 'Nuevo tipo de memorándum'}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Definí el patrón (secciones y campos) y las validaciones institucionales.
                                    </p>
                                </div>
                                <button type="button" onClick={resetForm} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label="Cerrar">
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={pedirConfirmacionGuardar} className="flex flex-col min-h-0">
                                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                                    {/* Identidad */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Campo label="Nombre del tipo *">
                                            <input
                                                type="text"
                                                required
                                                value={form.nombre}
                                                onChange={(e) => setForm((f) => ({
                                                    ...f,
                                                    nombre: e.target.value,
                                                    codigo: modal.modo === 'crear' ? slugify(e.target.value) : f.codigo,
                                                }))}
                                                className="ofbol-input w-full !py-2 !text-xs"
                                                placeholder="Memorándum de Designación"
                                            />
                                        </Campo>
                                        <Campo label="Código *" hint="Mayúsculas, números, _ y -">
                                            <input
                                                type="text"
                                                required
                                                value={form.codigo}
                                                onChange={(e) => setForm((f) => ({ ...f, codigo: slugify(e.target.value) }))}
                                                className="ofbol-input w-full !py-2 !text-xs font-mono"
                                                placeholder="MEMO_DESIGNACION"
                                            />
                                        </Campo>
                                        <Campo label="Categoría">
                                            <select
                                                value={form.categoria}
                                                onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
                                                className="ofbol-input w-full !py-2 !text-xs"
                                            >
                                                {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </Campo>
                                        <Campo label="Tipo de documento vinculado" hint="Opcional: mide su uso real">
                                            <select
                                                value={form.id_tipo}
                                                onChange={(e) => setForm((f) => ({ ...f, id_tipo: e.target.value }))}
                                                className="ofbol-input w-full !py-2 !text-xs"
                                            >
                                                <option value="">Sin vínculo</option>
                                                {tiposDocumento.map((t) => (
                                                    <option key={t.id_tipo} value={t.id_tipo}>{t.nombre}</option>
                                                ))}
                                            </select>
                                        </Campo>
                                        <div className="sm:col-span-2">
                                            <Campo label="Descripción">
                                                <textarea
                                                    rows={2}
                                                    value={form.descripcion}
                                                    onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                                                    className="ofbol-input w-full !text-xs"
                                                    placeholder="Describe cuándo se emite este memorándum…"
                                                />
                                            </Campo>
                                        </div>
                                    </div>

                                    {/* Color */}
                                    <div>
                                        <p className={LABEL}>Color identificador</p>
                                        <div className="flex gap-2 mt-1">
                                            {PALETA.map((c) => (
                                                <button
                                                    key={c}
                                                    type="button"
                                                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                                                    className="w-7 h-7 rounded-lg border-2 transition-transform"
                                                    style={{ background: c, borderColor: form.color === c ? '#0a0f0d' : 'transparent', transform: form.color === c ? 'scale(1.1)' : 'none' }}
                                                    aria-label={`Color ${c}`}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Formato: secciones */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className={LABEL}>Formato — secciones y campos *</p>
                                            <button type="button" onClick={addSeccion} className="text-[10px] font-black uppercase text-[#3d4a2c] hover:underline flex items-center gap-1">
                                                <Plus size={12} /> Añadir sección
                                            </button>
                                        </div>
                                        {form.secciones.map((s, i) => (
                                            <div key={i} className="rounded-[14px] border border-slate-200 p-3 space-y-2 bg-slate-50/60">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={s.titulo}
                                                        onChange={(e) => setSeccion(i, { titulo: e.target.value })}
                                                        placeholder={`Título de la sección ${i + 1}`}
                                                        className="ofbol-input flex-1 !py-2 !text-xs font-bold"
                                                    />
                                                    {form.secciones.length > 1 && (
                                                        <button type="button" onClick={() => delSeccion(i)} className="p-1.5 rounded-lg text-slate-400 hover:text-[#8f2020] hover:bg-red-50" aria-label="Quitar sección">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                                <input
                                                    type="text"
                                                    value={s.camposTexto}
                                                    onChange={(e) => setSeccion(i, { camposTexto: e.target.value })}
                                                    placeholder="Campos separados por coma (ej. Destinatario, Grado, C.I., Fecha)"
                                                    className="ofbol-input w-full !py-2 !text-xs"
                                                />
                                            </div>
                                        ))}
                                        <Campo label="Pie institucional (opcional)">
                                            <input
                                                type="text"
                                                value={form.pie}
                                                onChange={(e) => setForm((f) => ({ ...f, pie: e.target.value }))}
                                                placeholder='Ej. "Presente.-"'
                                                className="ofbol-input w-full !py-2 !text-xs"
                                            />
                                        </Campo>
                                    </div>

                                    {/* Validaciones */}
                                    <div className="space-y-3">
                                        <p className={LABEL}>Validaciones del patrón</p>
                                        {camposDisponibles.length > 0 && (
                                            <div>
                                                <p className="text-[10px] text-slate-500 mb-1.5">Campos obligatorios</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {camposDisponibles.map((c) => {
                                                        const activo = form.campos_requeridos.includes(c);
                                                        return (
                                                            <button
                                                                key={c}
                                                                type="button"
                                                                onClick={() => toggleRequerido(c)}
                                                                className="px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors"
                                                                style={activo
                                                                    ? { background: 'rgba(61,74,44,0.1)', color: '#3d4a2c', borderColor: 'rgba(61,74,44,0.35)' }
                                                                    : { background: 'white', color: '#5a615f', borderColor: '#e2e0db' }}
                                                            >
                                                                {activo ? '' : ''}{c}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <Campo label="Longitud mínima del documento" hint="Caracteres">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={form.longitud_minima}
                                                    onChange={(e) => setForm((f) => ({ ...f, longitud_minima: e.target.value }))}
                                                    className="ofbol-input w-full !py-2 !text-xs tabular-nums"
                                                />
                                            </Campo>
                                            <Campo label="Palabras clave requeridas" hint="Separadas por coma">
                                                <input
                                                    type="text"
                                                    value={form.palabras_clave_texto}
                                                    onChange={(e) => setForm((f) => ({ ...f, palabras_clave_texto: e.target.value }))}
                                                    placeholder="Policía Boliviana, memorándum"
                                                    className="ofbol-input w-full !py-2 !text-xs"
                                                />
                                            </Campo>
                                        </div>
                                        <div className="flex flex-wrap gap-4">
                                            <Check label="Exige firma del mando" checked={form.requiere_firma} onChange={(v) => setForm((f) => ({ ...f, requiere_firma: v }))} />
                                            <Check label="Exige sello institucional" checked={form.requiere_sello} onChange={(v) => setForm((f) => ({ ...f, requiere_sello: v }))} />
                                            <Check label="Activo en el sistema" checked={form.activo} onChange={(v) => setForm((f) => ({ ...f, activo: v }))} />
                                        </div>
                                    </div>
                                </div>

                                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                                    <button type="button" onClick={resetForm} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold">
                                        Cancelar
                                    </button>
                                    <button type="submit" className="ofbol-btn-primary !py-2.5 !px-5 !text-xs">
                                        <ShieldCheck size={14} /> Revisar y confirmar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ══════════ MODAL DE CONFIRMACIÓN ══════════ */}
                {confirmar && (
                    <div
                        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
                        role="dialog"
                        aria-modal="true"
                        onKeyDown={(e) => { if (e.key === 'Escape') setConfirmar(null); }}
                    >
                        <div className="bg-white rounded-[14px] max-w-lg w-full p-6 border border-slate-200 space-y-4 ofbol-animate-slide-up">
                            {confirmar.accion === 'guardar' ? (
                                <>
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck size={18} className="text-[#3d4a2c]" />
                                        <h3 className="text-base font-black text-slate-900">
                                            {modal?.modo === 'editar' ? 'Confirmar cambios' : 'Confirmar creación'}
                                        </h3>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        Estás por {modal?.modo === 'editar' ? 'modificar' : 'crear'} la definición de un tipo de
                                        memorándum institucional. Este patrón se aplicará a los documentos emitidos con este tipo.
                                    </p>
                                    <ResumenForm form={form} />
                                    <label className="flex items-start gap-2.5 p-3 rounded-[14px] border border-slate-200 bg-slate-50 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={confirmar.acepto}
                                            onChange={(e) => setConfirmar((c) => ({ ...c, acepto: e.target.checked }))}
                                            className="mt-0.5 w-4 h-4 rounded accent-[#3d4a2c]"
                                        />
                                        <span className="text-[11px] text-slate-700 leading-snug">
                                            Confirmo que la información es correcta y asumo la responsabilidad del cambio.
                                        </span>
                                    </label>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle size={18} className="text-[#8f2020]" />
                                        <h3 className="text-base font-black text-slate-900">Eliminar tipo de memorándum</h3>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        Esta acción no se puede deshacer. Para confirmar, escribí el nombre exacto:
                                        {' '}<strong className="font-mono text-slate-900">{confirmar.memo?.nombre}</strong>
                                    </p>
                                    <input
                                        type="text"
                                        value={confirmar.texto}
                                        onChange={(e) => setConfirmar((c) => ({ ...c, texto: e.target.value }))}
                                        placeholder="Escribí el nombre exacto"
                                        className="ofbol-input w-full !py-2.5 !text-sm"
                                        autoFocus
                                    />
                                </>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setConfirmar(null)}
                                    disabled={guardando}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold disabled:opacity-40"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    disabled={guardando || (confirmar.accion === 'guardar' ? !confirmar.acepto : confirmar.texto.trim() !== confirmar.memo?.nombre)}
                                    onClick={confirmar.accion === 'guardar' ? guardar : eliminar}
                                    className="ofbol-btn-primary !py-2.5 !px-5 !text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                                    style={confirmar.accion === 'eliminar' ? { background: '#8f2020' } : undefined}
                                >
                                    {guardando ? <><Loader2 size={14} className="animate-spin" /> Procesando…</> : (confirmar.accion === 'guardar' ? 'Confirmar y guardar' : 'Eliminar definitivamente')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </LayoutComandoGeneral>
    );
}

/* ── Piezas auxiliares ── */

const LABEL = 'text-[11px] font-black uppercase tracking-[0.08em] text-slate-500 mb-1.5 block';

function Kpi({ etiqueta, valor, sub, icon, acento }) {
    return (
        <div className="ofbol-card p-4">
            <div className="flex items-center gap-1.5 text-slate-400">
                <span style={{ color: acento }}>{icon}</span>
                <p className="text-[9px] font-black uppercase tracking-[0.12em]">{etiqueta}</p>
            </div>
            <p className="text-2xl font-black text-[#0a0f0d] mt-1.5 tabular-nums leading-none">{valor}</p>
            {sub && <p className="text-[10px] font-bold mt-1.5 truncate" style={{ color: acento }}>{sub}</p>}
        </div>
    );
}

function Campo({ label, hint, children }) {
    return (
        <div>
            <label className={LABEL}>{label}{hint && <span className="ml-2 font-medium normal-case tracking-normal text-slate-400">{hint}</span>}</label>
            {children}
        </div>
    );
}

function Check({ label, checked, onChange }) {
    return (
        <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 rounded accent-[#3d4a2c]" />
            <span className="text-[11px] font-semibold text-slate-700">{label}</span>
        </label>
    );
}

function Chip({ texto, icon, mini }) {
    return (
        <span className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white text-slate-600 font-bold ${mini ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]'}`}>
            {icon}{texto}
        </span>
    );
}

function ResumenForm({ form }) {
    const secciones = form.secciones.filter((s) => s.titulo.trim());
    return (
        <div className="rounded-[14px] border border-slate-200 bg-slate-50/70 p-3 space-y-2 max-h-56 overflow-y-auto">
            <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: form.color }} />
                <p className="text-xs font-black text-slate-900">{form.nombre || 'Sin nombre'}</p>
                <span className="font-mono text-[10px] text-slate-400">{form.codigo || slugify(form.nombre)}</span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 flex items-center gap-1">
                <Eye size={10} /> Formato
            </p>
            {secciones.length === 0 ? (
                <p className="text-[11px] text-slate-400">Sin secciones.</p>
            ) : secciones.map((s, i) => (
                <p key={i} className="text-[11px] text-slate-700">
                    <span className="font-bold">{i + 1}. {s.titulo}</span>
                    {s.camposTexto.trim() && <span className="text-slate-500"> — {s.camposTexto}</span>}
                </p>
            ))}
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 pt-1">Validaciones</p>
            <div className="flex flex-wrap gap-1.5">
                <Chip mini texto={`${form.campos_requeridos.length} campos requeridos`} />
                {Number(form.longitud_minima) > 0 && <Chip mini texto={`mín. ${form.longitud_minima} caract.`} />}
                {form.palabras_clave_texto.trim() && <Chip mini texto={form.palabras_clave_texto.trim()} />}
                {form.requiere_firma && <Chip mini texto="exige firma" />}
                {form.requiere_sello && <Chip mini texto="exige sello" />}
                {!form.activo && <Chip mini texto="inactivo" />}
            </div>
        </div>
    );
}
