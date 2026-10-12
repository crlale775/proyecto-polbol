/**
 * Login — pantalla institucional de autenticación de OFBOL
 *
 * Diseño ORIGINAL: no es el típico "split con gradiente genérico".
 * El panel lateral muestra el FLUJO DOCUMENTAL VIVO (el memorándum que
 * viaja: Secretaría → Comando Dptal. → Revisión → Registro), con el
 * escudo institucional y la identidad militar boliviana.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../js/context/AuthContext';
import api from '../../js/lib/api';
import Alert from '../../js/components/ui/Alert';
import Spinner from '../../js/components/ui/Spinner';
import { User, Lock, LogIn, FileText, Send, ClipboardCheck, Archive, ShieldCheck, Eye, EyeOff, AlertTriangle } from 'lucide-react';

// Etapas del flujo documental (panel lateral animado)
const ETAPAS = [
    { icon: FileText, nombre: 'Secretaría EPI', detalle: 'Emisión del trámite' },
    { icon: Send, nombre: 'Comando Dptal.', detalle: 'Recepción y revisión' },
    { icon: ClipboardCheck, nombre: 'Validación', detalle: 'Control normativo' },
    { icon: Archive, nombre: 'Registro', detalle: 'Escalafón oficial' },
];

export default function Login() {
    const [form, setForm] = useState({ usuario: '', password: '', recordar: false });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [verPassword, setVerPassword] = useState(false);
    const [bloqMayus, setBloqMayus] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
        if (error) setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.usuario.trim() || !form.password.trim()) {
            setError('Por favor completa todos los campos.');
            return;
        }
        setLoading(true);
        setError(null);

        try {
            const found = await api.post('/login', {
                usuario: form.usuario.trim(),
                password: form.password,
            });

            const epiNombre = found.epi?.nombre ?? 'EPI Asignada';
            const rolNombre = found.rol?.nombre ?? 'Usuario';

            const sessionUser = {
                id_usuario: found.id_usuario,
                usuario: found.usuario,
                correo: found.correo,
                id_epi: found.id_epi,
                id_rol: found.id_rol,
                epi: epiNombre,
                rol: rolNombre,
                estado: found.estado,
            };

            login(sessionUser, form.recordar);

            const rolLower = rolNombre.toLowerCase();
            if (rolLower.includes('departamental')) {
                navigate('/comando-departamental/dashboard', { replace: true });
            } else if (rolLower.includes('general')) {
                navigate('/comando-general/dashboard', { replace: true });
            } else {
                navigate('/secretario/dashboard', { replace: true });
            }
        } catch (err) {
            setError(err.message || 'Error al conectar con el servidor.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* ═══ PANEL LATERAL INSTITUCIONAL — Flujo documental vivo ═══ */}
            <div
                className="hidden lg:flex lg:w-[46%] relative overflow-hidden"
                style={{
                    background: '#0b100d',
                }}
            >
                {/* Marca de agua del escudo */}
                <div
                    className="absolute -right-24 -bottom-24 opacity-[0.05] pointer-events-none"
                    style={{ transform: 'rotate(-8deg)' }}
                >
                    <ShieldCheck size={380} color="#8a9a6d" strokeWidth={1} />
                </div>

                <div className="relative z-10 flex flex-col justify-between p-12 w-full">
                    {/* Logo superior */}
                    <div className="flex items-center gap-3.5">
                        <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center"
                            style={{
                                background: 'rgba(138, 154, 109, 0.14)',
                                border: '1px solid rgba(138, 154, 109, 0.25)',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
                            }}
                        >
                            <ShieldCheck size={20} color="#8a9a6d" strokeWidth={2} />
                        </div>
                        <div>
                            <p style={{ color: 'rgba(255,255,255,0.92)', fontWeight: 800, fontSize: '14px', letterSpacing: '0.04em' }}>
                                POLICÍA BOLIVIANA
                            </p>
                            <p style={{ color: '#8a9a6d', fontWeight: 700, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', marginTop: '2px' }}>
                                OFBOL · Gestión Documental
                            </p>
                        </div>
                    </div>

                    {/* Título + flujo animado */}
                    <div className="flex-1 flex flex-col justify-center max-w-lg">
                        <p
                            style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                letterSpacing: '0.18em',
                                textTransform: 'uppercase',
                                color: '#8a9a6d',
                                marginBottom: '14px',
                            }}
                        >
                            Plataforma Institucional · 2026
                        </p>
                        <h1
                            style={{
                                color: 'white',
                                fontWeight: 900,
                                fontSize: '34px',
                                lineHeight: '1.12',
                                letterSpacing: '-0.02em',
                                marginBottom: '12px',
                            }}
                        >
                            El trámite policial,
                            <br />
                            <span style={{ color: '#8a9a6d' }}>de principio a fin.</span>
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13.5px', lineHeight: '1.7', maxWidth: '400px' }}>
                            Emisión, revisión normativa y registro oficial del escalafón, en una sola vía institucional trazable.
                        </p>

                        {/* FLUJO DOCUMENTAL VIVO */}
                        <div className="mt-12 relative">
                            {/* Línea conectora */}
                            <div
                                className="absolute top-[18px] left-[8%] right-[8%] h-[2px]"
                                style={{
                                    background: 'rgba(138,154,109,0.32)',
                                }}
                            />
                            <div className="grid grid-cols-4 gap-2">
                                {ETAPAS.map((etapa, i) => {
                                    const Icono = etapa.icon;
                                    return (
                                        <div key={etapa.nombre} className="flex flex-col items-center text-center">
                                            <div
                                                className="relative flex items-center justify-center rounded-xl"
                                                style={{
                                                    width: '38px',
                                                    height: '38px',
                                                    background: 'rgba(10,15,13,0.9)',
                                                    border: '1px solid rgba(138,154,109,0.35)',
                                                    boxShadow: '0 0 0 4px rgba(10,15,13,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
                                                    zIndex: 2,
                                                }}
                                            >
                                                <Icono size={16} color="#8a9a6d" strokeWidth={1.8} />
                                                {/* Punto vivo: pulse en el nodo de la etapa */}
                                                {i === 1 && (
                                                    <span
                                                        className="absolute -top-1 -right-1"
                                                        style={{
                                                            width: '7px',
                                                            height: '7px',
                                                            borderRadius: '50%',
                                                            background: '#c2a03e',
                                                            animation: 'epi-parpadeo 1.8s ease-in-out infinite',
                                                        }}
                                                    />
                                                )}
                                            </div>
                                            <p style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(255,255,255,0.85)', marginTop: '8px', letterSpacing: '0.02em' }}>
                                                {etapa.nombre}
                                            </p>
                                            <p style={{ fontSize: '8.5px', fontWeight: 500, color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>
                                                {etapa.detalle}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Micro-datos institucionales */}
                        <div className="flex gap-8 mt-12">
                            {[
                                { value: '9', label: 'EPIs conectadas' },
                                { value: '3', label: 'Niveles de mando' },
                                { value: '100%', label: 'Trazabilidad' },
                            ].map((stat) => (
                                <div key={stat.label}>
                                    <p style={{ color: 'white', fontWeight: 900, fontSize: '22px', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                                        {stat.value}
                                    </p>
                                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '2px' }}>
                                        {stat.label}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Pie */}
                    <div className="flex items-center justify-between">
                        <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: '10.5px', fontWeight: 500 }}>
                            © 2026 · Comando Departamental La Paz · Uso oficial exclusivo
                        </p>
                        <span style={{ color: 'rgba(138,154,109,0.5)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em' }}>
                            RESERVADO
                        </span>
                    </div>
                </div>
            </div>

            {/* ═══ PANEL DE FORMULARIO ═══ */}
            <div className="flex-1 flex items-center justify-center p-6 lg:p-12" style={{ background: '#f8f7f4' }}>
                <div className="w-full max-w-sm">
                    {/* Logo móvil */}
                    <div className="lg:hidden flex items-center gap-3 mb-10">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: '#3d4a2c', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)' }}
                        >
                            <ShieldCheck size={18} color="white" />
                        </div>
                        <div>
                            <p style={{ color: '#0a0f0d', fontWeight: 800, fontSize: '13px' }}>POLICÍA BOLIVIANA</p>
                            <p style={{ color: '#5a615f', fontWeight: 600, fontSize: '9px', letterSpacing: '0.15em' }}>OFBOL</p>
                        </div>
                    </div>

                    {/* Título */}
                    <div className="mb-8">
                        <h2 style={{ color: '#14181a', fontWeight: 900, fontSize: '28px', letterSpacing: '-0.025em', marginBottom: '6px' }}>
                            Iniciar sesión
                        </h2>
                        <p style={{ color: '#5a615f', fontSize: '13px' }}>
                            Ingresa tus credenciales institucionales.
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-6" role="alert" aria-live="polite">
                            <Alert type="error" onClose={() => setError(null)}>
                                {error}
                            </Alert>
                        </div>
                    )}

                    {/* Formulario */}
                    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                        {/* Usuario */}
                        <div>
                            <label
                                htmlFor="login-usuario"
                                style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#3f4849', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '6px' }}
                            >
                                Usuario
                            </label>
                            <div className="relative">
                                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#a8a5a0' }} />
                                <input
                                    type="text"
                                    id="login-usuario"
                                    name="usuario"
                                    value={form.usuario}
                                    onChange={handleChange}
                                    placeholder="tu.usuario…"
                                    autoComplete="username"
                                    spellCheck={false}
                                    autoFocus
                                    className="ofbol-input w-full pl-10"
                                />
                            </div>
                        </div>

                        {/* Contraseña */}
                        <div>
                            <label
                                htmlFor="login-password"
                                style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#3f4849', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '6px' }}
                            >
                                Contraseña
                            </label>
                            <div className="relative">
                                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#a8a5a0' }} />
                                <input aria-label="Contraseña institucional"
                                    type={verPassword ? 'text' : 'password'}
                                    id="login-password"
                                    name="password"
                                    value={form.password}
                                    onChange={handleChange}
                                    onKeyUp={(e) => setBloqMayus(e.getModifierState?.('CapsLock') ?? false)}
                                    onBlur={() => setBloqMayus(false)}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    className="ofbol-input w-full pl-10 pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setVerPassword((v) => !v)}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors"
                                    style={{ color: '#a8a5a0' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.color = '#3d4a2c'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.color = '#a8a5a0'; }}
                                    aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                    aria-pressed={verPassword}
                                    tabIndex={-1}
                                >
                                    {verPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                            {bloqMayus && (
                                <p className="text-[10.5px] font-bold mt-1.5 flex items-center gap-1" style={{ color: '#7f5a07' }}>
                                    <AlertTriangle size={12} aria-hidden="true" /> Bloq Mayús está activado
                                </p>
                            )}
                        </div>

                        {/* Recordarme */}
                        <div className="flex items-center gap-2.5">
                            <input
                                type="checkbox"
                                id="recordar"
                                name="recordar"
                                checked={form.recordar}
                                onChange={handleChange}
                                className="w-4 h-4 rounded border-[#d1cec8] accent-[#3d4a2c]"
                            />
                            <label htmlFor="recordar" style={{ fontSize: '12px', color: '#5a615f', cursor: 'pointer' }}>
                                Recordar sesión
                            </label>
                        </div>

                        {/* Botón */}
                        <button type="submit" disabled={loading} className="ofbol-btn-primary ofbol-sheen w-full text-sm">
                            {loading ? (
                                <>
                                    <Spinner size="sm" />
                                    Verificando…
                                </>
                            ) : (
                                <>
                                    Ingresar al sistema
                                    <LogIn size={15} />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Demo accounts */}
                    <div className="mt-8 pt-6" style={{ borderTop: '1px solid #e8e6e1' }}>
                        <p style={{ fontSize: '10px', fontWeight: 800, color: '#3d4a2c', letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'center', marginBottom: '12px' }}>
                            Acceso rápido (pruebas)
                        </p>

                        <div className="space-y-2">
                            <select aria-label="Filtro"
                                onChange={(e) => {
                                    if (e.target.value) {
                                        setForm({ usuario: e.target.value, password: 'ale775', recordar: true });
                                    }
                                }}
                                className="ofbol-input w-full text-xs"
                                defaultValue=""
                            >
                                <option value="" disabled>Seleccionar Secretario EPI…</option>
                                <option value="sec_sanpedro">sec_sanpedro · EPI 1 San Pedro</option>
                                <option value="sec_sur">sec_sur · EPI 2 Sur</option>
                                <option value="sec_ferroviaria">sec_ferroviaria · EPI 3 Ferroviaria</option>
                                <option value="sec_munaypata">sec_munaypata · EPI 4 Munaypata</option>
                                <option value="sec_cotahuma">sec_cotahuma · EPI 5 Cotahuma</option>
                                <option value="sec_chijini">sec_chijini · EPI 6 Chijini</option>
                                <option value="sec_centro">sec_centro · EPI 7 Centro</option>
                                <option value="sec_bosquecillo">sec_bosquecillo · EPI 8 Bosquecillo</option>
                                <option value="sec_merced">sec_merced · EPI 9 Merced</option>
                            </select>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setForm({ usuario: 'revisor_lapaz', password: 'ale775', recordar: true })}
                                    className="ofbol-lift py-2.5 px-3 rounded-lg text-xs font-bold transition-colors"
                                    style={{
                                        background: 'rgba(154, 111, 10, 0.08)',
                                        color: '#7f5a07',
                                        border: '1px solid rgba(154, 111, 10, 0.15)',
                                    }}
                                >
                                    Comando Dptal.
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setForm({ usuario: 'comando_general', password: 'ale775', recordar: true })}
                                    className="ofbol-lift py-2.5 px-3 rounded-lg text-xs font-bold transition-colors"
                                    style={{
                                        background: 'rgba(26, 92, 82, 0.08)',
                                        color: '#1a5c52',
                                        border: '1px solid rgba(26, 92, 82, 0.15)',
                                    }}
                                >
                                    Comando General
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <p style={{ textAlign: 'center', fontSize: '10px', color: '#a8a5a0', marginTop: '32px' }}>
                        OFBOL · Base de Datos: <strong style={{ color: '#3d4a2c' }}>comlapaz</strong> © 2026
                    </p>
                </div>
            </div>
        </div>
    );
}