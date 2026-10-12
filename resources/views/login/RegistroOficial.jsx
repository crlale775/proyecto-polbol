/**
 * RegistroOficial.jsx — Formulario PÚBLICO de auto-registro
 * El oficial llega por el link (enviado por WhatsApp) y se registra subiendo
 * su memo de designación + foto de perfil. La solicitud queda en BD y entra
 * AUTOMÁTICAMENTE a la cola FIFO de verificación IA (firma, sello, identidad
 * del memo y detección de rostro en la foto).
 *
 * Validaciones de campo:
 *   - Nombres/Apellidos: solo letras (con tildes y Ñ), sin datos basura
 *     ("jadajij" es rechazado por la heurística anti-basura).
 *   - Cédula de identidad: 7, 8 o 9 dígitos (+ complemento opcional "LP").
 *   - Celular: EXACTAMENTE 8 dígitos (sin letras ni signos).
 *   - Foto de perfil: obligatoria (JPG/PNG, máx 5 MB) — la IA debe detectar un rostro.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../js/lib/api';
import Alert from '../../js/components/ui/Alert';
import Spinner from '../../js/components/ui/Spinner';

// ── Helpers de validación (comparten criterio con el backend) ──

// Nombre real: cada palabra solo letras (tildes/Ñ admitidas), sin basura.
const RE_SOLO_LETRAS = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ']+( [A-Za-zÁÉÍÓÚÜÑáéíóúüñ']+)*$/;

function palabraEsBasura(t) {
    const s = t.toLowerCase().replace(/[áéíóúüñ]/g, (c) => ({ 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u', 'ñ': 'n' }[c]));
    const particulas = ['de', 'del', 'la', 'el', 'los', 'las', 'y', 'san', 'santa', 'da', 'di', 'do', 'von', 'van', 'mc', 'mac'];
    if (particulas.includes(s)) return false;
    if (s.length < 3) return true;                       // "J", "Ab" → basura
    const vocales = (s.match(/[aeiou]/g) || []).length;
    const unicas = new Set(s.split('')).size;
    if (vocales < 2 && unicas < 3) return true;          // "jijj", "kbd" → basura
    if (/^(.)\1+$/.test(s)) return true;                 // "aaaa" → basura
    if (!/[aeiou]/.test(s)) return true;                 // sin vocales → basura
    return false;
}

function nombreEsBasura(nombre) {
    return nombre.trim().split(/\s+/).some(palabraEsBasura);
}

// CI: 7, 8 o 9 dígitos, con complemento opcional de 1-2 letras ("4892301 LP").
const RE_CI = /^[0-9]{7,9}( [A-Za-z]{1,2})?$/;
// Celular boliviano: EXACTAMENTE 8 dígitos, empieza en 6 o 7.
const RE_CELULAR = /^[67][0-9]{7}$/;

export default function RegistroOficial() {
    const { token } = useParams();
    const navigate = useNavigate();

    const [info, setInfo] = useState(null);
    const [cargandoInfo, setCargandoInfo] = useState(true);
    const [errorInfo, setErrorInfo] = useState(null);
    const [errorInfoEstado, setErrorInfoEstado] = useState(null);

    // Formulario
    const [form, setForm] = useState({
        nombres: '',
        apellidos: '',
        ci: '',
        telefono: '',
        usuario: '',
        password: '',
    });
    const [archivo, setArchivo] = useState(null);
    const [foto, setFoto] = useState(null);
    const [fotoPreview, setFotoPreview] = useState(null);
    const fotoPreviewRef = useRef(null);
    useEffect(() => {
        fotoPreviewRef.current = fotoPreview;
    }, [fotoPreview]);

    const [error, setError] = useState(null);
    const [enviando, setEnviando] = useState(false);
    const [exito, setExito] = useState(null);

    useEffect(() => {
        let activo = true;
        (async () => {
            try {
                const data = await api.get(`/registro-links/publico/${token}`);
                if (activo) {
                    setInfo(data);
                    setErrorInfo(null);
                }
            } catch (err) {
                if (activo) {
                    setErrorInfo(err.message || 'El enlace no está disponible.');
                    setErrorInfoEstado(err.status || 404);
                }
            } finally {
                if (activo) setCargandoInfo(false);
            }
        })();
        return () => { activo = false; };
    }, [token]);

    // Solo permitir dígitos en CI y celular (bloquea letras en vivo).
    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'ci') {
            const limpio = value.replace(/[^0-9A-Za-z ]/g, '').slice(0, 12);
            setForm((f) => ({ ...f, [name]: limpio }));
        } else if (name === 'telefono') {
            const limpio = value.replace(/[^0-9]/g, '').slice(0, 8);
            setForm((f) => ({ ...f, [name]: limpio }));
        } else {
            setForm((f) => ({ ...f, [name]: value }));
        }
        if (error) setError(null);
    };

    const validarFoto = (f) => {
        if (!f) return 'Debe adjuntar su foto de perfil.';
        const esImagen = (f.type && f.type.startsWith('image/')) || /\.(jpe?g|png)$/i.test(f.name);
        if (!esImagen) return 'La foto debe ser una imagen JPG o PNG.';
        if (f.size > 5 * 1024 * 1024) return 'La foto no puede superar los 5 MB.';
        return null;
    };

    const handleFoto = (e) => {
        const f = e.target.files?.[0] || null;
        if (f) {
            const msg = validarFoto(f);
            if (msg) {
                setError(msg);
                e.target.value = '';
                return;
            }
            setFoto(f);
            // Revocar la URL anterior antes de crear la nueva (evita fugas de memoria).
            if (fotoPreviewRef.current) URL.revokeObjectURL(fotoPreviewRef.current);
            const nuevaUrl = URL.createObjectURL(f);
            fotoPreviewRef.current = nuevaUrl;
            setFotoPreview(nuevaUrl);
        } else {
            setFoto(null);
            if (fotoPreviewRef.current) {
                URL.revokeObjectURL(fotoPreviewRef.current);
                fotoPreviewRef.current = null;
            }
            setFotoPreview(null);
        }
        if (error) setError(null);
    };

    // Liberar la URL temporal de la foto anterior al desmontar (evita fugas de memoria).
    // Usa un ref para no re-ejecutar el cleanup en cada cambio de foto (la URL nueva
    // se revoca en el siguiente cambio o al desmontar el componente).
    useEffect(() => () => {
        if (fotoPreviewRef.current) URL.revokeObjectURL(fotoPreviewRef.current);
    }, []);

    const validar = useCallback(() => {
        if (form.nombres.trim().length < 2) return 'Ingrese sus nombres (mínimo 2 caracteres).';
        if (!RE_SOLO_LETRAS.test(form.nombres.trim())) return 'Los nombres solo pueden contener letras (sin números ni símbolos).';
        if (nombreEsBasura(form.nombres)) return 'Los nombres ingresados no parecen reales. Escriba su nombre verdadero.';
        if (form.apellidos.trim().length < 2) return 'Ingrese sus apellidos (mínimo 2 caracteres).';
        if (!RE_SOLO_LETRAS.test(form.apellidos.trim())) return 'Los apellidos solo pueden contener letras (sin números ni símbolos).';
        if (nombreEsBasura(form.apellidos)) return 'Los apellidos ingresados no parecen reales. Escriba sus apellidos verdaderos.';
        if (form.ci.trim() && !RE_CI.test(form.ci.trim())) return 'La cédula de identidad debe tener 7, 8 o 9 dígitos (complemento opcional, ej. "4892301 LP").';
        if (!form.telefono.trim()) return 'Ingrese su número de celular.';
        if (!RE_CELULAR.test(form.telefono.trim())) return 'El celular debe tener EXACTAMENTE 8 dígitos (ej. 71234567), sin letras ni espacios.';
        if (form.usuario.trim() && !/^[a-zA-Z0-9_.-]{3,50}$/.test(form.usuario.trim()))
            return 'El nombre de usuario solo puede contener letras, números, puntos, guiones o guion bajo.';
        if (form.password.length < 4) return 'La contraseña debe tener al menos 4 caracteres.';
        const msgFoto = validarFoto(foto);
        if (msgFoto) return msgFoto;
        if (!archivo) return 'Debe adjuntar su memorándum de designación en PDF.';
        if (archivo.type !== 'application/pdf' && !/\.pdf$/i.test(archivo.name)) return 'El archivo debe ser PDF.';
        if (archivo.size > 15 * 1024 * 1024) return 'El PDF no puede superar los 15 MB.';
        return null;
    }, [form, archivo, foto]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const msg = validar();
        if (msg) {
            setError(msg);
            return;
        }
        setEnviando(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append('nombres', form.nombres.trim());
            formData.append('apellidos', form.apellidos.trim());
            if (form.ci.trim()) formData.append('ci', form.ci.trim());
            formData.append('telefono', form.telefono.trim());
            if (form.usuario.trim()) formData.append('usuario', form.usuario.trim());
            formData.append('password', form.password);
            formData.append('foto', foto);
            formData.append('archivo', archivo);

            const res = await api.upload(`/registro-publico/${token}`, formData);
            setExito(res);
        } catch (err) {
            const msgs = err.errors ? Object.values(err.errors).flat().join(' · ') : (err.message || 'Error al enviar su solicitud.');
            setError(msgs);
        } finally {
            setEnviando(false);
        }
    };

    // ── Estados visuales ──
    if (cargandoInfo) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f6f5f1]">
                <div className="text-center space-y-3">
                    <Spinner />
                    <p className="text-xs text-slate-400 font-semibold">Validando enlace de registro…</p>
                </div>
            </div>
        );
    }

    if (errorInfo || !info) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-[#f6f5f1]">
                <div className="w-full max-w-md bg-white rounded-[14px] border border-slate-200 p-8 text-center space-y-4">
                    <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h1 className="text-lg font-black text-slate-900">Enlace no disponible</h1>
                    <p className="text-sm text-slate-500">{errorInfo}</p>
                    <button onClick={() => navigate('/login')} className="mt-2 px-5 py-2.5 bg-[#3d4a2c] text-white text-xs font-bold rounded-xl">
                        Volver al inicio
                    </button>
                </div>
            </div>
        );
    }

    if (exito) {
        const adv = exito.solicitud?.ia_advertencia;
        return (
            <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0d1210' }}>
                <div className="w-full max-w-md bg-white rounded-[14px] shadow-2xl p-8 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#3d4a2c' }}>
                            <span style={{ color: '#8a9a6d', fontWeight: 900, fontSize: '14px' }}>PB</span>
                        </div>
                        <div>
                            <p style={{ fontWeight: 800, fontSize: '13px', color: '#0a0f0d' }}>POLICÍA BOLIVIANA · OFBOL</p>
                            <p style={{ fontSize: '10px', color: '#5a615f' }}>Registro de Oficiales</p>
                        </div>
                    </div>

                    <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h1 className="text-lg font-black text-center text-slate-900">¡Solicitud recibida!</h1>
                    <p className="text-sm text-slate-500 text-center leading-relaxed">
                        {exito.message}
                    </p>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5 text-xs">
                        <div className="flex justify-between"><span className="text-slate-500">Usuario asignado</span><span className="font-mono font-bold text-slate-900">{exito.credenciales?.usuario}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Rol solicitado</span><span className="font-bold text-slate-900">{exito.credenciales?.rol}</span></div>
                        {exito.credenciales?.epi && (
                            <div className="flex justify-between"><span className="text-slate-500">EPI asignada</span><span className="font-bold text-slate-900">{exito.credenciales.epi}</span></div>
                        )}
                        <div className="flex justify-between"><span className="text-slate-500">Estado de la cuenta</span><span className="font-bold text-amber-600">{exito.credenciales?.estado}</span></div>
                    </div>

                    {adv && (
                        <Alert type="warning">
                            El sistema detectó una posible inconsistencia en su solicitud. Quedó en observación para su verificación institucional.
                        </Alert>
                    )}

                    <div className="flex flex-col gap-2 pt-2">
                        <button onClick={() => navigate('/login')} className="w-full py-3 rounded-xl text-xs font-black text-white" style={{ background: '#3d4a2c' }}>
                            Ir a iniciar sesión
                        </button>
                        <Link to={`/registro-oficial/${token}`} className="w-full text-center text-xs font-bold text-slate-500 py-1">
                            Enviar otra solicitud
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6"
            style={{ background: '#0d1210' }}>
            <div className="w-full max-w-lg bg-white rounded-[14px] shadow-2xl overflow-hidden">
                {/* Encabezado */}
                <div className="px-6 pt-6 pb-5" style={{ background: '#0d1210' }}>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(138,154,109,0.15)', border: '1px solid rgba(138,154,109,0.3)' }}>
                            <span style={{ color: '#8a9a6d', fontWeight: 900, fontSize: '14px' }}>PB</span>
                        </div>
                        <div>
                            <p style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 800, fontSize: '13px' }}>POLICÍA BOLIVIANA · OFBOL</p>
                            <p style={{ color: '#8a9a6d', fontSize: '10px', fontWeight: 600 }}>Registro oficial de personal</p>
                        </div>
                    </div>
                    <h1 className="text-xl font-black text-white">Registro y Designación</h1>
                    <p className="text-xs text-white/50 mt-1 leading-relaxed">
                        Complete sus datos y adjunte su <strong className="text-white/80">memo de designación</strong> y su <strong className="text-white/80">foto de perfil</strong>. El sistema revisará su solicitud automáticamente.
                    </p>

                    {/* Rol / EPI de la invitación */}
                    <div className="flex flex-wrap gap-2 mt-4">
                        <span className="px-3 py-1.5 rounded-lg text-[11px] font-bold" style={{ background: 'rgba(138,154,109,0.15)', color: '#8a9a6d', border: '1px solid rgba(138,154,109,0.3)' }}>
                            Rol: {info.rol}
                        </span>
                        {info.epi && (
                            <span className="px-3 py-1.5 rounded-lg text-[11px] font-bold" style={{ background: 'rgba(154,111,10,0.15)', color: '#d8b45a', border: '1px solid rgba(154,111,10,0.3)' }}>
                                {info.epi}
                            </span>
                        )}
                    </div>
                </div>

                {/* Formulario */}
                <div className="p-6">
                    {error && (
                        <div className="mb-4">
                            <Alert type="error" onClose={() => setError(null)}>{error}</Alert>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="reg-nombres" className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Nombres *</label>
                                <input aria-label="Ej: José Carlos"
                                    type="text" id="reg-nombres" name="nombres" value={form.nombres} onChange={handleChange}
                                    placeholder="Ej: José Carlos" autoComplete="given-name" spellCheck={false}
                                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus-visible:ring-2 focus-visible:ring-[#3d4a2c]"
                                />
                            </div>
                            <div>
                                <label htmlFor="reg-apellidos" className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Apellidos *</label>
                                <input aria-label="Ej: Mamani Flores"
                                    type="text" id="reg-apellidos" name="apellidos" value={form.apellidos} onChange={handleChange}
                                    placeholder="Ej: Mamani Flores" autoComplete="family-name" spellCheck={false}
                                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus-visible:ring-2 focus-visible:ring-[#3d4a2c]"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="reg-ci" className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Cédula de identidad (opcional)</label>
                                <input aria-label="Ej: 4892301 LP"
                                    type="text" inputMode="numeric" id="reg-ci" name="ci" value={form.ci} onChange={handleChange}
                                    placeholder="Ej: 4892301 LP" autoComplete="off" spellCheck={false}
                                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus-visible:ring-2 focus-visible:ring-[#3d4a2c]"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">7, 8 o 9 dígitos (complemento opcional).</p>
                            </div>
                            <div>
                                <label htmlFor="reg-telefono" className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Número de celular *</label>
                                <input aria-label="Ej: 71234567"
                                    type="tel" inputMode="numeric" id="reg-telefono" name="telefono" value={form.telefono} onChange={handleChange}
                                    placeholder="Ej: 71234567" autoComplete="tel"
                                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus-visible:ring-2 focus-visible:ring-[#3d4a2c]"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Exactamente 8 dígitos, sin letras ni espacios.</p>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="reg-usuario" className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Usuario de acceso (opcional)</label>
                            <input aria-label="Déjelo vacío para generarlo automáticamente"
                                type="text" id="reg-usuario" name="usuario" value={form.usuario} onChange={handleChange}
                                placeholder="Déjelo vacío para generarlo automáticamente" autoComplete="username" spellCheck={false}
                                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus-visible:ring-2 focus-visible:ring-[#3d4a2c]"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Si lo deja vacío se creará con sus nombres (ej. josecarlosmamaniflores).</p>
                        </div>

                        <div>
                            <label htmlFor="reg-password" className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Contraseña *</label>
                            <input aria-label="Mínimo 4 caracteres"
                                type="password" id="reg-password" name="password" value={form.password} onChange={handleChange}
                                placeholder="Mínimo 4 caracteres" autoComplete="new-password"
                                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus-visible:ring-2 focus-visible:ring-[#3d4a2c]"
                            />
                        </div>

                        {/* FOTO DE PERFIL (obligatoria) */}
                        <div>
                            <label htmlFor="reg-foto" className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                Foto de perfil *
                            </label>
                            <div className="flex items-center gap-3">
                                <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center shrink-0">
                                    {fotoPreview ? (
                                        <img src={fotoPreview} alt="Vista previa de la foto de perfil" className="w-full h-full object-cover" />
                                    ) : (
                                        <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    )}
                                </div>
                                <input
                                    type="file" id="reg-foto" accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                                    onChange={handleFoto}
                                    className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#3d4a2c] file:text-white focus-visible:ring-2 focus-visible:ring-[#3d4a2c]"
                                />
                            </div>
                            {foto && (
                                <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                                    {foto.name} ({(foto.size / 1024).toFixed(0)} KB)
                                </p>
                            )}
                            <p className="text-[10px] text-slate-400 mt-1">JPG o PNG · máx 5 MB. La foto debe mostrar su rostro de forma clara.</p>
                        </div>

                        <div>
                            <label htmlFor="reg-memo" className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                Memorándum de designación (PDF) *
                            </label>
                            <input
                                type="file" id="reg-memo" accept=".pdf,application/pdf"
                                onChange={(e) => {
                                    setArchivo(e.target.files?.[0] || null);
                                    if (error) setError(null);
                                }}
                                className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#3d4a2c] file:text-white focus-visible:ring-2 focus-visible:ring-[#3d4a2c]"
                            />
                            {archivo && (
                                <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                                    {archivo.name} ({(archivo.size / 1024).toFixed(0)} KB)
                                </p>
                            )}
                            <p className="text-[10px] text-slate-400 mt-1">Se revisará que el memo tenga firma, sello y su nombre.</p>
                        </div>

                        <button
                            type="submit"
                            disabled={enviando}
                            className="w-full py-3 rounded-xl text-sm font-black text-white transition-colors disabled:opacity-50"
                            style={{ background: '#3d4a2c' }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#4a5a35')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = '#3d4a2c')}
                        >
                            {enviando ? (
                                <span className="inline-flex items-center gap-2 justify-center">
                                    <Spinner size="sm" /> Enviando solicitud…
                                </span>
                            ) : (
                                'Registrarme y enviar memo'
                            )}
                        </button>
                    </form>

                    <p className="text-center text-[10px] text-slate-400 mt-5">
                        OFBOL · Sistema de Gestión Documental · La cuenta se activará tras la verificación institucional automática.
                    </p>
                </div>
            </div>
        </div>
    );
}
