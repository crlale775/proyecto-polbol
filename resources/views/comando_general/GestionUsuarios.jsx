/**
 * GestionUsuarios.jsx — Módulo de Gestión Integral de Usuarios
 * Comando General de la Policía Boliviana
 * Diseño limpio, visual y moderno (PolBol / Claude design)
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import LayoutComandoGeneral from '../../js/components/LayoutComandoGeneral';
import Spinner from '../../js/components/ui/Spinner';
import Alert from '../../js/components/ui/Alert';
import Modal from '../../js/components/ui/Modal';
import ConfirmDialog from '../../js/components/ui/ConfirmDialog';
import { KpiPanel, ACENTOS } from '../../js/components/ui/Panel';
import { EstadoVacio } from '../../js/components/ui/Graficos';
import api from '../../js/lib/api';

/* Clave de arranque institucional (ver la nota de seguridad en MEJORAS_REALIZADAS.md). */
const CLAVE_POR_DEFECTO = 'ale775';

export default function GestionUsuarios() {
    const [usuarios, setUsuarios] = useState([]);
    const [roles, setRoles] = useState([]);
    const [epis, setEpis] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtroRol, setFiltroRol] = useState('todos');
    const [busqueda, setBusqueda] = useState('');
    const [mensaje, setMensaje] = useState(null);

    // Modales
    const [modalCrear, setModalCrear] = useState(false);
    const [modalEditar, setModalEditar] = useState(null);
    const [modalPassword, setModalPassword] = useState(null);
    const [confirmarEstado, setConfirmarEstado] = useState(null);
    const [guardando, setGuardando] = useState(false);

    const [formCrear, setFormCrear] = useState({
        usuario: '',
        correo: '',
        password: CLAVE_POR_DEFECTO,
        id_rol: '1',
        id_epi: '1',
        estado: true,
    });

    const [formEditar, setFormEditar] = useState({
        usuario: '',
        correo: '',
        id_rol: '1',
        id_epi: '',
        estado: true,
    });

    const [formPassword, setFormPassword] = useState({
        password: CLAVE_POR_DEFECTO,
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [usersRes, rolesRes, episRes] = await Promise.all([
                api.get('/usuarios'),
                api.get('/roles'),
                api.get('/epis'),
            ]);
            if (Array.isArray(usersRes)) setUsuarios(usersRes);
            if (Array.isArray(rolesRes)) setRoles(rolesRes);
            if (Array.isArray(episRes)) setEpis(episRes);
        } catch (err) {
            setMensaje({ tipo: 'error', texto: 'Error al cargar los usuarios.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCrearUsuario = async (e) => {
        e.preventDefault();
        try {
            setGuardando(true);
            await api.post('/usuarios', {
                usuario: formCrear.usuario,
                correo: formCrear.correo,
                password: formCrear.password,
                id_rol: parseInt(formCrear.id_rol, 10),
                id_epi: formCrear.id_rol === '1' && formCrear.id_epi ? parseInt(formCrear.id_epi, 10) : null,
                estado: formCrear.estado,
            });

            setMensaje({ tipo: 'success', texto: `Usuario ${formCrear.usuario} creado exitosamente.` });
            setModalCrear(false);
            setFormCrear({ usuario: '', correo: '', password: CLAVE_POR_DEFECTO, id_rol: '1', id_epi: '1', estado: true });
            fetchData();
        } catch (err) {
            const detalle = err.errors ? Object.values(err.errors).flat().join(' · ') : (err.message || '');
            setMensaje({ tipo: 'error', texto: detalle ? `No se pudo crear el usuario: ${detalle}` : 'No se pudo crear el usuario. Verifique los datos.' });
        } finally {
            setGuardando(false);
        }
    };

    const handleEditarUsuario = async (e) => {
        e.preventDefault();
        if (!modalEditar) return;
        try {
            setGuardando(true);
            await api.put(`/usuarios/${modalEditar.id_usuario}`, {
                usuario: formEditar.usuario,
                correo: formEditar.correo,
                id_rol: parseInt(formEditar.id_rol, 10),
                id_epi: formEditar.id_rol === '1' && formEditar.id_epi ? parseInt(formEditar.id_epi, 10) : null,
                estado: formEditar.estado,
            });

            setMensaje({ tipo: 'success', texto: `Usuario ${formEditar.usuario} actualizado correctamente.` });
            setModalEditar(null);
            fetchData();
        } catch (err) {
            const detalle = err.errors ? Object.values(err.errors).flat().join(' · ') : (err.message || '');
            setMensaje({ tipo: 'error', texto: detalle ? `Error al actualizar usuario: ${detalle}` : 'Error al actualizar usuario.' });
        } finally {
            setGuardando(false);
        }
    };

    const handleCambiarPassword = async (e) => {
        e.preventDefault();
        if (!modalPassword) return;
        try {
            setGuardando(true);
            await api.put(`/usuarios/${modalPassword.id_usuario}`, {
                password: formPassword.password,
            });

            setMensaje({ tipo: 'success', texto: `Contraseña de ${modalPassword.usuario} reestablecida con éxito.` });
            setModalPassword(null);
            setFormPassword({ password: CLAVE_POR_DEFECTO });
        } catch (err) {
            const detalle = err.errors ? Object.values(err.errors).flat().join(' · ') : (err.message || '');
            setMensaje({ tipo: 'error', texto: detalle ? `Error al cambiar contraseña: ${detalle}` : 'Error al cambiar contraseña.' });
        } finally {
            setGuardando(false);
        }
    };

    /**
     * Desactivar corta el acceso al sistema, así que pasa por confirmación;
     * reactivar es reversible y no la pide.
     */
    const handleToggleEstado = async (u) => {
        if (!u) return;
        const activar = !u.estado;
        try {
            setGuardando(true);
            await api.put(`/usuarios/${u.id_usuario}`, {
                ...u,
                estado: activar,
            });
            setMensaje({
                tipo: 'success',
                texto: `Usuario ${u.usuario} ${activar ? 'activado' : 'desactivado'} correctamente.`,
            });
            setConfirmarEstado(null);
            fetchData();
        } catch (err) {
            setMensaje({ tipo: 'error', texto: 'No se pudo cambiar el estado del usuario.' });
        } finally {
            setGuardando(false);
        }
    };

    const filtrados = useMemo(() => {
        return usuarios.filter((u) => {
            const q = busqueda.toLowerCase();
            const nombre = (u.usuario || '').toLowerCase();
            const correo = (u.correo || '').toLowerCase();
            const rolNom = (u.rol?.nombre || '').toLowerCase();
            const epiNom = (u.epi?.nombre || '').toLowerCase();

            const coincideBusqueda = nombre.includes(q) || correo.includes(q) || rolNom.includes(q) || epiNom.includes(q);

            const coincideRol =
                filtroRol === 'todos' ||
                (filtroRol === 'epi' && (rolNom.includes('secretario') || rolNom.includes('epi'))) ||
                (filtroRol === 'departamental' && (rolNom.includes('departamental') || rolNom.includes('comando d'))) ||
                (filtroRol === 'general' && (rolNom.includes('general') || rolNom.includes('comando g')));

            return coincideBusqueda && coincideRol;
        });
    }, [usuarios, busqueda, filtroRol]);

    const stats = useMemo(() => {
        const total = usuarios.length;
        const activos = usuarios.filter((u) => u.estado).length;
        const episCount = usuarios.filter((u) => (u.rol?.nombre || '').toLowerCase().includes('secretario')).length;
        return { total, activos, episCount };
    }, [usuarios]);

    return (
        <LayoutComandoGeneral>
            <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 ofbol-page-enter">

                {/* Encabezado */}
                <header className="min-w-0">
                    <h1 className="ofbol-display heading-balance">Usuarios del sistema</h1>
                    <p className="ofbol-nota mt-2">
                        Cuentas de los tres niveles de mando. Cada usuario pertenece a un rol
                        institucional y, cuando corresponde, a una Estación Policial Integral.
                    </p>
                </header>

                {mensaje && (
                    <Alert
                        type={mensaje.tipo}
                        onClose={() => setMensaje(null)}
                    >
                        {mensaje.texto}
                    </Alert>
                )}

                {/* Cifras: una sola cifra líder (el total) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <KpiPanel grande etiqueta="Total de usuarios" valor={stats.total} acento={ACENTOS.oliva} />
                    <KpiPanel
                        etiqueta="Usuarios activos"
                        valor={stats.activos}
                        sub={`${stats.total ? Math.round((stats.activos / stats.total) * 100) : 0}% de la plantilla`}
                        acento={ACENTOS.teal}
                    />
                    <KpiPanel etiqueta="Secretarios de EPI" valor={stats.episCount} acento={ACENTOS.olivaClaro} />
                </div>

                {/* Filtros */}
                <div className="ofbol-card p-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <div
                            className="flex gap-1 p-1 rounded-[12px] shrink-0 flex-wrap"
                            style={{ background: '#f4f2ec', border: '1px solid var(--ofbol-line)' }}
                            role="group"
                            aria-label="Filtrar por rol institucional"
                        >
                            {[
                                { id: 'todos', label: 'Todos' },
                                { id: 'epi', label: 'Secretaría EPI' },
                                { id: 'departamental', label: 'Cmd. Departamental' },
                                { id: 'general', label: 'Cmd. General' },
                            ].map((tab) => {
                                const activo = filtroRol === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        aria-pressed={activo}
                                        onClick={() => setFiltroRol(tab.id)}
                                        className="px-3 py-1.5 text-xs font-bold rounded-[9px]"
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

                        <div className="relative flex-1 max-w-md">
                            <Search
                                size={15}
                                className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                                style={{ color: 'var(--ofbol-muted)' }}
                                aria-hidden="true"
                            />
                            <input
                                type="search"
                                aria-label="Buscar por usuario, correo, rol o EPI"
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                placeholder="Buscar por usuario, correo, rol o EPI…"
                                className="ofbol-input w-full pl-10"
                            />
                        </div>
                    </div>
                </div>

                {/* Tabla */}
                <section className="ofbol-card overflow-hidden">
                    {loading ? (
                        <div className="py-20 flex justify-center"><Spinner /></div>
                    ) : filtrados.length === 0 ? (
                        <EstadoVacio
                            icono={Search}
                            titulo={usuarios.length === 0 ? 'Todavía no hay usuarios' : 'Sin resultados'}
                            nota={
                                usuarios.length === 0
                                    ? 'Cargá la primera cuenta institucional para empezar a asignar roles.'
                                    : 'Ningún usuario coincide con la búsqueda y el rol seleccionados.'
                            }
                            accion={
                                usuarios.length > 0 && (busqueda || filtroRol !== 'todos') ? (
                                    <button
                                        type="button"
                                        onClick={() => { setBusqueda(''); setFiltroRol('todos'); }}
                                        className="ofbol-btn-ghost mt-1"
                                    >
                                        Limpiar filtros
                                    </button>
                                ) : null
                            }
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="ofbol-table">
                                <thead>
                                    <tr>
                                        <th>Usuario</th>
                                        <th>Correo</th>
                                        <th>Rol institucional</th>
                                        <th>Asignación</th>
                                        <th>Estado</th>
                                        <th className="nums">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtrados.map((u) => {
                                        const rolNom = u.rol?.nombre || 'Operador';
                                        const esEpi = rolNom.toLowerCase().includes('secretario') || rolNom.toLowerCase().includes('epi');
                                        const esDptal = rolNom.toLowerCase().includes('departamental');

                                        return (
                                            <tr key={u.id_usuario}>
                                                <td>
                                                    <div className="flex items-center gap-2.5">
                                                        <div
                                                            className="w-8 h-8 rounded-full flex items-center justify-center font-black text-[11px] shrink-0"
                                                            style={{ background: 'var(--ofbol-olive)', color: '#fbfaf6' }}
                                                            aria-hidden="true"
                                                        >
                                                            {(u.usuario?.[0] || 'U').toUpperCase()}
                                                        </div>
                                                        <span className="font-bold" style={{ color: 'var(--ofbol-ink)' }}>{u.usuario}</span>
                                                    </div>
                                                </td>
                                                <td className="font-mono">{u.correo || '—'}</td>
                                                <td>
                                                    <span
                                                        className="ofbol-chip"
                                                        style={
                                                            esEpi
                                                                ? { background: 'var(--ofbol-olive-wash)', color: 'var(--ofbol-olive)' }
                                                                : esDptal
                                                                ? { background: 'var(--ofbol-amber-wash)', color: 'var(--ofbol-amber)' }
                                                                : { background: 'var(--ofbol-teal-wash)', color: 'var(--ofbol-teal)' }
                                                        }
                                                    >
                                                        {rolNom}
                                                    </span>
                                                </td>
                                                <td>{u.epi?.nombre || 'Nivel central'}</td>
                                                <td>
                                                    <span
                                                        className="ofbol-chip"
                                                        style={
                                                            u.estado
                                                                ? { background: 'var(--ofbol-teal-wash)', color: 'var(--ofbol-teal)' }
                                                                : { background: 'var(--ofbol-crimson-wash)', color: 'var(--ofbol-crimson)' }
                                                        }
                                                    >
                                                        {u.estado ? 'Activo' : 'Inactivo'}
                                                    </span>
                                                </td>
                                                <td className="nums whitespace-nowrap space-x-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setModalEditar(u);
                                                            setFormEditar({
                                                                usuario: u.usuario,
                                                                correo: u.correo || '',
                                                                id_rol: String(u.id_rol || 1),
                                                                id_epi: String(u.id_epi || ''),
                                                                estado: u.estado,
                                                            });
                                                        }}
                                                        className="ofbol-btn-ghost !py-1 !px-2.5"
                                                        aria-label={`Editar la cuenta de ${u.usuario}`}
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setModalPassword(u);
                                                            setFormPassword({ password: CLAVE_POR_DEFECTO });
                                                        }}
                                                        className="ofbol-btn-ghost !py-1 !px-2.5"
                                                        aria-label={`Restablecer la contraseña de ${u.usuario}`}
                                                    >
                                                        Clave
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => (u.estado ? setConfirmarEstado(u) : handleToggleEstado(u))}
                                                        className={u.estado ? 'ofbol-btn-danger !py-1 !px-2.5' : 'ofbol-btn-ghost !py-1 !px-2.5'}
                                                        aria-label={
                                                            u.estado
                                                                ? `Desactivar el acceso de ${u.usuario}`
                                                                : `Reactivar el acceso de ${u.usuario}`
                                                        }
                                                    >
                                                        {u.estado ? 'Desactivar' : 'Activar'}
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

                {/* Modal: crear usuario */}
                <Modal
                    open={modalCrear}
                    onClose={() => setModalCrear(false)}
                    title="Crear Nuevo Usuario Institucional"
                    size="md"
                >
                    <form onSubmit={handleCrearUsuario} className="space-y-4">
                        <div>
                            <label htmlFor="crear-usuario" className="ofbol-etiqueta block mb-1.5">Nombre de Usuario *</label>
                            <input aria-label="Ej: sec_cotahuma"
                                type="text"
                                id="crear-usuario"
                                required
                                autoComplete="username"
                                spellCheck={false}
                                value={formCrear.usuario}
                                onChange={(e) => setFormCrear({ ...formCrear, usuario: e.target.value })}
                                className="ofbol-input w-full"
                                placeholder="Ej: sec_cotahuma"
                            />
                        </div>

                        <div>
                            <label htmlFor="crear-correo" className="ofbol-etiqueta block mb-1.5">Correo Electrónico</label>
                            <input aria-label="correo@policia.bo"
                                type="email"
                                id="crear-correo"
                                autoComplete="email"
                                value={formCrear.correo}
                                onChange={(e) => setFormCrear({ ...formCrear, correo: e.target.value })}
                                className="ofbol-input w-full"
                                placeholder="correo@policia.bo"
                            />
                        </div>

                        <div>
                            <label htmlFor="crear-password" className="ofbol-etiqueta block mb-1.5">Contraseña Inicial</label>
                            <input
                                type="password"
                                id="crear-password"
                                required
                                autoComplete="new-password"
                                value={formCrear.password}
                                onChange={(e) => setFormCrear({ ...formCrear, password: e.target.value })}
                                className="ofbol-input w-full font-mono"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="crear-rol" className="ofbol-etiqueta block mb-1.5">Rol *</label>
                                <select
                                    id="crear-rol"
                                    value={formCrear.id_rol}
                                    onChange={(e) => setFormCrear({ ...formCrear, id_rol: e.target.value })}
                                    className="ofbol-input w-full"
                                >
                                    {roles.map((r) => (
                                        <option key={r.id_rol} value={r.id_rol}>{r.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label htmlFor="crear-epi" className="ofbol-etiqueta block mb-1.5">EPI Asignada</label>
                                <select
                                    id="crear-epi"
                                    value={formCrear.id_epi}
                                    onChange={(e) => setFormCrear({ ...formCrear, id_epi: e.target.value })}
                                    disabled={formCrear.id_rol !== '1'}
                                    className="ofbol-input w-full"
                                >
                                    <option value="">Ninguna (Nivel Central)</option>
                                    {epis.map((e) => (
                                        <option key={e.id_epi} value={e.id_epi}>{e.nombre}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4" style={{ borderTop: '1px solid var(--ofbol-line)' }}>
                            <button
                                type="button"
                                onClick={() => setModalCrear(false)}
                                className="ofbol-btn-ghost"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={guardando}
                                className="ofbol-btn-primary"
                            >
                                {guardando ? 'Guardando…' : 'Crear Usuario'}
                            </button>
                        </div>
                    </form>
                </Modal>

                {/* ─ Modal Editar Usuario ─ */}
                <Modal
                    open={!!modalEditar}
                    onClose={() => setModalEditar(null)}
                    title={`Editar: ${modalEditar?.usuario || ''}`}
                    size="md"
                >
                    <form onSubmit={handleEditarUsuario} className="space-y-4">
                        <div>
                            <label htmlFor="editar-usuario" className="ofbol-etiqueta block mb-1.5">Nombre de Usuario</label>
                            <input
                                type="text"
                                id="editar-usuario"
                                required
                                autoComplete="username"
                                spellCheck={false}
                                value={formEditar.usuario}
                                onChange={(e) => setFormEditar({ ...formEditar, usuario: e.target.value })}
                                className="ofbol-input w-full"
                            />
                        </div>

                        <div>
                            <label htmlFor="editar-correo" className="ofbol-etiqueta block mb-1.5">Correo Electrónico</label>
                            <input
                                type="email"
                                id="editar-correo"
                                autoComplete="email"
                                value={formEditar.correo}
                                onChange={(e) => setFormEditar({ ...formEditar, correo: e.target.value })}
                                className="ofbol-input w-full"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="editar-rol" className="ofbol-etiqueta block mb-1.5">Rol</label>
                                <select
                                    id="editar-rol"
                                    value={formEditar.id_rol}
                                    onChange={(e) => setFormEditar({ ...formEditar, id_rol: e.target.value })}
                                    className="ofbol-input w-full"
                                >
                                    {roles.map((r) => (
                                        <option key={r.id_rol} value={r.id_rol}>{r.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label htmlFor="editar-epi" className="ofbol-etiqueta block mb-1.5">EPI Asignada</label>
                                <select
                                    id="editar-epi"
                                    value={formEditar.id_epi}
                                    onChange={(e) => setFormEditar({ ...formEditar, id_epi: e.target.value })}
                                    disabled={formEditar.id_rol !== '1'}
                                    className="ofbol-input w-full"
                                >
                                    <option value="">Ninguna</option>
                                    {epis.map((e) => (
                                        <option key={e.id_epi} value={e.id_epi}>{e.nombre}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4" style={{ borderTop: '1px solid var(--ofbol-line)' }}>
                            <button
                                type="button"
                                onClick={() => setModalEditar(null)}
                                className="ofbol-btn-ghost"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={guardando}
                                className="ofbol-btn-primary"
                            >
                                {guardando ? 'Guardando…' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </form>
                </Modal>

                {/* ─ Modal Password ─ */}
                <Modal
                    open={!!modalPassword}
                    onClose={() => setModalPassword(null)}
                    title={`Reestablecer Contraseña: ${modalPassword?.usuario || ''}`}
                    size="sm"
                >
                    <form onSubmit={handleCambiarPassword} className="space-y-4">
                        <div>
                            <label htmlFor="nueva-password" className="ofbol-etiqueta block mb-1.5">Nueva Contraseña</label>
                            <input
                                type="password"
                                id="nueva-password"
                                required
                                autoComplete="new-password"
                                value={formPassword.password}
                                onChange={(e) => setFormPassword({ password: e.target.value })}
                                className="ofbol-input w-full font-mono"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setModalPassword(null)}
                                className="ofbol-btn-ghost"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={guardando}
                                className="ofbol-btn-primary"
                            >
                                {guardando ? 'Actualizando…' : 'Cambiar Clave'}
                            </button>
                        </div>
                    </form>
                </Modal>

                {/* Confirmación de desactivación */}
                <ConfirmDialog
                    open={!!confirmarEstado}
                    titulo="Desactivar acceso"
                    mensaje={`${confirmarEstado?.usuario ?? 'El usuario'} perderá el acceso al sistema de inmediato.`}
                    detalle="La cuenta se conserva; solo se corta el ingreso."
                    tono="crimson"
                    confirmarTexto="Desactivar acceso"
                    procesando={guardando}
                    onConfirmar={() => handleToggleEstado(confirmarEstado)}
                    onCancelar={() => setConfirmarEstado(null)}
                />

            </div>
        </LayoutComandoGeneral>
    );
}
