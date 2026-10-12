/**
 * GestionSecretarios.jsx — Gestión de los Secretarios de las 9 EPIs
 * (Comando Departamental).
 *
 * Cada fila es una Estación Policial Integral: con secretario asignado o
 * vacante. El Comando puede asignar, reasignar, restablecer la clave o
 * desactivar el acceso; nunca eliminar (la trazabilidad de los memorándums
 * emitidos depende de que el usuario siga existiendo).
 *
 * Usa el sistema: `.ofbol-card` + `.ofbol-table`, `Modal` y `ConfirmDialog`
 * compartidos, campos `.ofbol-input` y acciones `.ofbol-btn-*`.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Key, ShieldCheck, UserRound } from 'lucide-react';
import LayoutComandoDepartamental from '../../js/components/LayoutComandoDepartamental';
import Spinner from '../../js/components/ui/Spinner';
import Alert from '../../js/components/ui/Alert';
import Modal from '../../js/components/ui/Modal';
import ConfirmDialog from '../../js/components/ui/ConfirmDialog';
import { EstadoVacio } from '../../js/components/ui/Graficos';
import api from '../../js/lib/api';

/* Clave de arranque con la que el Comando entrega la cuenta al secretario.
 * Está a la vista por decisión institucional, pero conviene tener presente
 * que viaja en el bundle: ver la nota de seguridad en MEJORAS_REALIZADAS.md. */
const CLAVE_POR_DEFECTO = 'ale775';

export default function GestionSecretarios() {
    const [epis, setEpis] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [mensaje, setMensaje] = useState(null);

    // Modales
    const [modalEditar, setModalEditar] = useState(null); // { epi, usuario }
    const [modalPassword, setModalPassword] = useState(null); // usuario
    const [confirmarEstado, setConfirmarEstado] = useState(null); // usuario
    const [guardando, setGuardando] = useState(false);

    const [formEditar, setFormEditar] = useState({
        usuario: '',
        correo: '',
        id_epi: '',
        estado: true,
    });

    const [formPassword, setFormPassword] = useState({ password: CLAVE_POR_DEFECTO });

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [episRes, usuariosRes] = await Promise.all([
                api.get('/epis'),
                api.get('/usuarios?id_rol=1'), // Solo Secretarios EPI (Rol ID 1)
            ]);
            if (Array.isArray(episRes)) setEpis(episRes);
            if (Array.isArray(usuariosRes)) setUsuarios(usuariosRes);
        } catch (err) {
            setMensaje({ tipo: 'error', texto: 'No se pudieron cargar los secretarios de EPI.' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const abrirEditar = (epi, usuario) => {
        setModalEditar({ epi, usuario });
        setFormEditar({
            usuario: usuario?.usuario || '',
            correo: usuario?.correo || '',
            id_epi: epi.id_epi,
            estado: usuario?.estado ?? true,
        });
    };

    const abrirPassword = (usuario) => {
        setModalPassword(usuario);
        setFormPassword({ password: CLAVE_POR_DEFECTO });
    };

    /** El error de la API se muestra tal cual: es lo que el Comando necesita leer. */
    const detalleDeError = (err) =>
        err.errors ? Object.values(err.errors).flat().join(' · ') : err.message || '';

    const handleGuardarUsuario = async (e) => {
        e.preventDefault();
        if (!modalEditar) return;

        try {
            setGuardando(true);
            if (modalEditar.usuario) {
                await api.put(`/usuarios/${modalEditar.usuario.id_usuario}`, {
                    usuario: formEditar.usuario,
                    correo: formEditar.correo,
                    id_epi: parseInt(formEditar.id_epi, 10),
                    estado: formEditar.estado,
                });
                setMensaje({
                    tipo: 'success',
                    texto: `Datos del secretario ${formEditar.usuario} actualizados.`,
                });
            } else {
                await api.post('/usuarios', {
                    usuario: formEditar.usuario,
                    correo: formEditar.correo,
                    password: CLAVE_POR_DEFECTO,
                    id_rol: 1, // Secretario EPI
                    id_epi: parseInt(formEditar.id_epi, 10),
                    estado: true,
                });
                setMensaje({
                    tipo: 'success',
                    texto: `Nuevo secretario asignado a la ${modalEditar.epi.nombre}.`,
                });
            }

            setModalEditar(null);
            fetchData();
        } catch (err) {
            const detalle = detalleDeError(err);
            setMensaje({
                tipo: 'error',
                texto: detalle
                    ? `No se pudo guardar la información del secretario: ${detalle}`
                    : 'No se pudo guardar la información del secretario.',
            });
        } finally {
            setGuardando(false);
        }
    };

    const handleRestablecerPassword = async (e) => {
        e.preventDefault();
        if (!modalPassword) return;

        try {
            setGuardando(true);
            await api.post(`/usuarios/${modalPassword.id_usuario}/reset-password`, {
                password: formPassword.password,
            });
            setMensaje({
                tipo: 'success',
                texto: `Contraseña restablecida para el usuario ${modalPassword.usuario}.`,
            });
            setModalPassword(null);
        } catch (err) {
            const detalle = detalleDeError(err);
            setMensaje({
                tipo: 'error',
                texto: detalle
                    ? `No se pudo restablecer la contraseña: ${detalle}`
                    : 'No se pudo restablecer la contraseña.',
            });
        } finally {
            setGuardando(false);
        }
    };

    /**
     * Desactivar corta el acceso de una persona al sistema, así que pasa por
     * confirmación. Reactivar es reversible y no la pide.
     */
    const ejecutarToggleEstado = async (usuario) => {
        if (!usuario) return;
        const nuevoEstado = !usuario.estado;
        try {
            setGuardando(true);
            await api.put(`/usuarios/${usuario.id_usuario}`, { estado: nuevoEstado });
            setMensaje({
                tipo: 'success',
                texto: `Secretario ${usuario.usuario} ${nuevoEstado ? 'reactivado' : 'desactivado'}.`,
            });
            setConfirmarEstado(null);
            fetchData();
        } catch (err) {
            setMensaje({ tipo: 'error', texto: 'No se pudo cambiar el estado del usuario.' });
        } finally {
            setGuardando(false);
        }
    };

    const vacantes = epis.length - epis.filter((e) => usuarios.some((u) => u.id_epi === e.id_epi)).length;

    return (
        <LayoutComandoDepartamental>
            <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 ofbol-page-enter">
                {/* Encabezado */}
                <header className="min-w-0">
                    <h1 className="ofbol-display heading-balance">Secretarios de unidad</h1>
                    <p className="ofbol-nota mt-2">
                        Un secretario por Estación Policial Integral. Desde acá el Comando asigna la
                        cuenta, la reasigna cuando un oficial rota y restablece la clave de arranque.
                    </p>
                </header>

                {mensaje && (
                    <Alert type={mensaje.tipo} onClose={() => setMensaje(null)}>
                        {mensaje.texto}
                    </Alert>
                )}

                {loading ? (
                    <div className="py-24 flex justify-center">
                        <Spinner />
                    </div>
                ) : (
                    <section className="ofbol-card overflow-hidden">
                        <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-3">
                            <h2 className="ofbol-titulo-seccion">Cuadro de asignación</h2>
                            <p className="ofbol-etiqueta tabular-nums">
                                {epis.length} unidades · {vacantes} vacante{vacantes === 1 ? '' : 's'}
                            </p>
                        </header>

                        {epis.length === 0 ? (
                            <EstadoVacio
                                icono={UserRound}
                                titulo="Sin unidades registradas"
                                nota="Todavía no hay Estaciones Policiales Integrales cargadas en el sistema."
                            />
                        ) : (
                            <div className="overflow-x-auto ofbol-scroll">
                                <table className="ofbol-table">
                                    <thead>
                                        <tr>
                                            <th className="nums">#</th>
                                            <th>Estación Policial Integral</th>
                                            <th>Secretario asignado</th>
                                            <th>Correo institucional</th>
                                            <th>Estado</th>
                                            <th className="nums">Acciones de mando</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {epis.map((epi, idx) => {
                                            const sec = usuarios.find((u) => u.id_epi === epi.id_epi);

                                            return (
                                                <tr key={epi.id_epi}>
                                                    <td className="nums tabular-nums" style={{ color: 'var(--ofbol-muted)' }}>
                                                        {idx + 1}
                                                    </td>
                                                    <td>
                                                        <div className="min-w-0">
                                                            <p className="font-medium leading-tight" style={{ color: 'var(--ofbol-ink)' }}>
                                                                {epi.nombre}
                                                            </p>
                                                            <p className="text-[11px]" style={{ color: 'var(--ofbol-muted)' }}>
                                                                {epi.ubicacion || 'Zona urbana La Paz'}
                                                            </p>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {sec ? (
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <span
                                                                    className="w-7 h-7 rounded-full flex items-center justify-center font-black text-[11px] shrink-0"
                                                                    style={{ background: 'var(--ofbol-olive)', color: '#fbfaf6' }}
                                                                    aria-hidden="true"
                                                                >
                                                                    {sec.usuario?.[0]?.toUpperCase()}
                                                                </span>
                                                                <div className="min-w-0">
                                                                    <p className="font-medium leading-tight" style={{ color: 'var(--ofbol-ink)' }}>
                                                                        {sec.usuario}
                                                                    </p>
                                                                    <p className="text-[11px]" style={{ color: 'var(--ofbol-muted)' }}>
                                                                        ID {sec.id_usuario}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="ofbol-chip" style={{ background: 'var(--ofbol-amber-wash)', color: 'var(--ofbol-amber)' }}>
                                                                Vacante
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="font-mono">{sec?.correo || '—'}</td>
                                                    <td>
                                                        {sec ? (
                                                            <span
                                                                className="ofbol-chip"
                                                                style={
                                                                    sec.estado
                                                                        ? { background: 'var(--ofbol-teal-wash)', color: 'var(--ofbol-teal)' }
                                                                        : { background: 'var(--ofbol-crimson-wash)', color: 'var(--ofbol-crimson)' }
                                                                }
                                                            >
                                                                {sec.estado ? 'Activo' : 'Inactivo'}
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: 'var(--ofbol-muted)' }}>—</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                                            <button
                                                                type="button"
                                                                onClick={() => abrirEditar(epi, sec)}
                                                                className="ofbol-btn-ghost !py-1.5 !px-3"
                                                                aria-label={
                                                                    sec
                                                                        ? `Editar o reasignar el secretario de ${epi.nombre}`
                                                                        : `Asignar un secretario a ${epi.nombre}`
                                                                }
                                                            >
                                                                {sec ? 'Editar / Cambiar' : 'Asignar'}
                                                            </button>

                                                            {sec && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => abrirPassword(sec)}
                                                                        className="ofbol-btn-ghost !py-1.5 !px-3"
                                                                        aria-label={`Restablecer la contraseña de ${sec.usuario}`}
                                                                    >
                                                                        <Key size={12} aria-hidden="true" /> Clave
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            sec.estado
                                                                                ? setConfirmarEstado(sec)
                                                                                : ejecutarToggleEstado(sec)
                                                                        }
                                                                        className={sec.estado ? 'ofbol-btn-danger !py-1.5 !px-3' : 'ofbol-btn-ghost !py-1.5 !px-3'}
                                                                        aria-label={
                                                                            sec.estado
                                                                                ? `Desactivar el acceso de ${sec.usuario}`
                                                                                : `Reactivar el acceso de ${sec.usuario}`
                                                                        }
                                                                    >
                                                                        {sec.estado ? 'Desactivar' : 'Activar'}
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                )}

                {/* Política institucional */}
                <div className="ofbol-card p-4 flex items-start gap-3">
                    <span
                        className="shrink-0 flex items-center justify-center w-9 h-9 rounded-xl"
                        style={{ background: 'var(--ofbol-olive-wash)', color: 'var(--ofbol-olive)' }}
                        aria-hidden="true"
                    >
                        <ShieldCheck size={17} strokeWidth={2.4} />
                    </span>
                    <p className="ofbol-nota">
                        <strong style={{ color: 'var(--ofbol-ink)' }}>Regla de seguridad institucional:</strong>{' '}
                        los usuarios secretarios nunca se eliminan físicamente de la base de datos, para
                        preservar la trazabilidad histórica de los memorándums emitidos. Solo se permite
                        desactivar o reasignar.
                    </p>
                </div>
            </div>

            {/* Modal: editar / asignar secretario */}
            <Modal
                open={!!modalEditar}
                onClose={() => setModalEditar(null)}
                title={modalEditar?.usuario ? 'Editar secretario de EPI' : 'Asignar secretario'}
                size="md"
            >
                {modalEditar && (
                    <form onSubmit={handleGuardarUsuario} className="space-y-4">
                        <p className="ofbol-etiqueta">{modalEditar.epi?.nombre}</p>

                        <div>
                            <label htmlFor="sec-usuario" className="ofbol-etiqueta block mb-1.5">
                                Nombre de usuario
                            </label>
                            <input
                                type="text"
                                id="sec-usuario"
                                required
                                autoComplete="username"
                                spellCheck={false}
                                value={formEditar.usuario}
                                onChange={(e) => setFormEditar({ ...formEditar, usuario: e.target.value })}
                                className="ofbol-input w-full"
                            />
                        </div>

                        <div>
                            <label htmlFor="sec-correo" className="ofbol-etiqueta block mb-1.5">
                                Correo institucional
                            </label>
                            <input
                                type="email"
                                id="sec-correo"
                                required
                                autoComplete="email"
                                value={formEditar.correo}
                                onChange={(e) => setFormEditar({ ...formEditar, correo: e.target.value })}
                                className="ofbol-input w-full"
                            />
                        </div>

                        <div>
                            <label htmlFor="sec-epi" className="ofbol-etiqueta block mb-1.5">
                                Estación asignada
                            </label>
                            <select
                                id="sec-epi"
                                value={formEditar.id_epi}
                                onChange={(e) => setFormEditar({ ...formEditar, id_epi: e.target.value })}
                                className="ofbol-input w-full"
                            >
                                {epis.map((e) => (
                                    <option key={e.id_epi} value={e.id_epi}>{e.nombre}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="estadoSec"
                                checked={formEditar.estado}
                                onChange={(e) => setFormEditar({ ...formEditar, estado: e.target.checked })}
                                className="w-4 h-4"
                                style={{ accentColor: 'var(--ofbol-olive)' }}
                            />
                            <label htmlFor="estadoSec" className="text-xs font-semibold" style={{ color: 'var(--ofbol-ink)' }}>
                                Usuario activo en el sistema
                            </label>
                        </div>

                        <div
                            className="flex justify-end gap-2 pt-4"
                            style={{ borderTop: '1px solid var(--ofbol-line)' }}
                        >
                            <button type="button" onClick={() => setModalEditar(null)} className="ofbol-btn-ghost">
                                Cancelar
                            </button>
                            <button type="submit" disabled={guardando} className="ofbol-btn-primary">
                                {guardando ? 'Guardando…' : 'Guardar cambios'}
                            </button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* Modal: restablecer contraseña */}
            <Modal
                open={!!modalPassword}
                onClose={() => setModalPassword(null)}
                title="Restablecer contraseña"
                size="sm"
            >
                {modalPassword && (
                    <form onSubmit={handleRestablecerPassword} className="space-y-4">
                        <p className="ofbol-etiqueta">Usuario: {modalPassword.usuario}</p>

                        <div>
                            <label htmlFor="sec-nueva-pass" className="ofbol-etiqueta block mb-1.5">
                                Nueva contraseña
                            </label>
                            <input
                                type="password"
                                id="sec-nueva-pass"
                                required
                                autoComplete="new-password"
                                value={formPassword.password}
                                onChange={(e) => setFormPassword({ password: e.target.value })}
                                className="ofbol-input w-full font-mono"
                            />
                            <p className="ofbol-nota mt-1.5">
                                La clave de arranque institucional es <strong>{CLAVE_POR_DEFECTO}</strong>;
                                el secretario debe cambiarla en su primer ingreso.
                            </p>
                        </div>

                        <div
                            className="flex justify-end gap-2 pt-4"
                            style={{ borderTop: '1px solid var(--ofbol-line)' }}
                        >
                            <button type="button" onClick={() => setModalPassword(null)} className="ofbol-btn-ghost">
                                Cancelar
                            </button>
                            <button type="submit" disabled={guardando} className="ofbol-btn-primary">
                                {guardando ? 'Restableciendo…' : 'Restablecer clave'}
                            </button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* Confirmación de desactivación */}
            <ConfirmDialog
                open={!!confirmarEstado}
                titulo="Desactivar acceso"
                mensaje={`${confirmarEstado?.usuario ?? 'El usuario'} perderá el acceso al sistema de inmediato.`}
                detalle="La cuenta se conserva para no romper la trazabilidad de los memorándums ya emitidos."
                tono="crimson"
                confirmarTexto="Desactivar acceso"
                procesando={guardando}
                onConfirmar={() => ejecutarToggleEstado(confirmarEstado)}
                onCancelar={() => setConfirmarEstado(null)}
            />
        </LayoutComandoDepartamental>
    );
}
