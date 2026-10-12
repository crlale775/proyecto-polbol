/**
 * Notificaciones — Avisos y Alertas del Comando Departamental de La Paz
 * Conecta con:
 *   - NotificacionController → GET /api/notificaciones, PUT /api/notificaciones/{id}
 */
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import LayoutComandoDepartamental from '../../js/components/LayoutComandoDepartamental';
import Spinner from '../../js/components/ui/Spinner';
import Alert from '../../js/components/ui/Alert';
import { useAuth } from '../../js/context/AuthContext';
import api from '../../js/lib/api';
import { ChipEnVivo, useSyncGlobal } from '../../js/components/ui/ToastEnVivo';

export default function Notificaciones() {
    const { user } = useAuth();
    const [notificaciones, setNotificaciones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filtro, setFiltro] = useState('todas');
    const [busqueda, setBusqueda] = useState('');

    const cargarNotificaciones = async () => {
        setLoading(true);
        try {
            const params = user?.id_usuario ? `?id_usuario=${user.id_usuario}` : '';
            const data = await api.get(`/notificaciones${params}`);
            setNotificaciones(Array.isArray(data) ? data : []);
        } catch (err) {
            setError('No se pudieron obtener las notificaciones.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let cancelado = false;
        (async () => {
            await cargarNotificaciones();
            if (cancelado) return;
        })();
        return () => { cancelado = true; };
    }, [user]);

    // ── MODO EN VIVO: refrescar la bandeja cuando llegue cualquier evento ──
    const { conectado } = useSyncGlobal();
    const cargarRef = useRef(cargarNotificaciones);
    useEffect(() => {
        cargarRef.current = cargarNotificaciones;
    });
    useEffect(() => {
        const onSync = () => {
            if (typeof cargarRef.current === 'function') cargarRef.current();
        };
        window.addEventListener('ofbol:sync', onSync);
        return () => window.removeEventListener('ofbol:sync', onSync);
    }, []);

    const marcarComoLeida = async (notif) => {
        if (notif.leido) return;
        try {
            await api.put(`/notificaciones/${notif.id_notificacion}`, {
                ...notif,
                leido: true,
            });
            setNotificaciones((prev) =>
                prev.map((n) => (n.id_notificacion === notif.id_notificacion ? { ...n, leido: true } : n))
            );
        } catch (_) {}
    };

    const marcarTodas = async () => {
        const noLeidas = notificaciones.filter((n) => !n.leido);
        if (noLeidas.length === 0) return;
        try {
            await Promise.all(
                noLeidas.map((n) =>
                    api.put(`/notificaciones/${n.id_notificacion}`, { ...n, leido: true })
                )
            );
            setNotificaciones((prev) => prev.map((n) => ({ ...n, leido: true })));
        } catch (_) {}
    };

    const filtradas = useMemo(() => {
        let list = [...notificaciones];
        if (filtro === 'no_leidas') list = list.filter((n) => !n.leido);
        if (filtro === 'leidas') list = list.filter((n) => n.leido);
        if (busqueda.trim()) {
            const q = busqueda.toLowerCase();
            list = list.filter((n) => n.titulo?.toLowerCase().includes(q) || n.mensaje?.toLowerCase().includes(q));
        }
        return list;
    }, [notificaciones, filtro, busqueda]);

    const noLeidasCount = notificaciones.filter((n) => !n.leido).length;

    return (
        <LayoutComandoDepartamental>
            <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6 ofbol-page-enter">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <div className="mb-2">
                            <ChipEnVivo conectado={conectado} />
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#fdf6e3] text-[#7f5a07] border border-[#f3e2b3]">
                                Centro de Comunicaciones
                            </span>
                            <span className="text-xs text-slate-400">· Avisos y Alertas Departamentales</span>
                        </div>
                        <h1 className="ofbol-display heading-balance">
                            Bandeja de Avisos y Notificaciones
                        </h1>
                    </div>

                    {noLeidasCount > 0 && (
                        <button
                            onClick={marcarTodas}
                            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors shadow-sm self-start sm:self-auto"
                        >
                            Marcar todas como leídas
                        </button>
                    )}
                </div>

                {error && <Alert type="warning" onClose={() => setError(null)}>{error}</Alert>}

                {/* Filtros */}
                <div className="bg-white rounded-[14px] border border-slate-100 p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600">
                        <button
                            onClick={() => setFiltro('todas')}
                            className={`px-3 py-1.5 rounded-lg transition-colors ${filtro === 'todas' ? 'bg-white text-slate-900 shadow-sm font-bold' : ''}`}
                        >
                            Todas ({notificaciones.length})
                        </button>
                        <button
                            onClick={() => setFiltro('no_leidas')}
                            className={`px-3 py-1.5 rounded-lg transition-colors ${filtro === 'no_leidas' ? 'bg-white text-amber-900 shadow-sm font-bold' : ''}`}
                        >
                            No leídas ({noLeidasCount})
                        </button>
                        <button
                            onClick={() => setFiltro('leidas')}
                            className={`px-3 py-1.5 rounded-lg transition-colors ${filtro === 'leidas' ? 'bg-white text-slate-900 shadow-sm font-bold' : ''}`}
                        >
                            Leídas
                        </button>
                    </div>

                    <input aria-label="Buscar en avisos..."
                        type="text"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar en avisos..."
                        className="w-full sm:w-60 px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3d4a2c] placeholder-slate-400"
                    />
                </div>

                {/* Lista */}
                <div className="bg-white rounded-[14px] border border-slate-100 overflow-hidden divide-y divide-slate-50">
                    {loading ? (
                        <div className="flex justify-center py-20"><Spinner /></div>
                    ) : filtradas.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 text-xs">
                            No hay notificaciones para mostrar.
                        </div>
                    ) : (
                        filtradas.map((notif) => (
                            <div
                                key={notif.id_notificacion}
                                className={`p-4 transition-colors flex items-start gap-4 ${
                                    !notif.leido ? 'bg-amber-50/30 hover:bg-amber-50/50' : 'hover:bg-slate-50'
                                }`}
                            >
                                <div
                                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                                        !notif.leido ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-100 text-slate-400'
                                    }`}
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-3">
                                        <p className={`text-sm ${!notif.leido ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                                            {notif.titulo}
                                        </p>
                                        <span className="text-[11px] text-slate-400 whitespace-nowrap">
                                            {notif.fecha ? new Date(notif.fecha).toLocaleString('es-BO') : 'Reciente'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-600 mt-1">{notif.mensaje}</p>

                                    <div className="mt-3 flex items-center gap-3">
                                        <Link
                                            to="/comando-departamental/revision"
                                            className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition-colors"
                                        >
                                            Ir a la Cola de Revisión →
                                        </Link>
                                    </div>
                                </div>

                                {!notif.leido && (
                                    <button
                                        onClick={() => marcarComoLeida(notif)}
                                        title="Marcar como leída"
                                        className="shrink-0 p-1.5 text-slate-400 hover:text-amber-700 rounded-lg"
                                    >
                                        <Check size={15} strokeWidth={2.5} aria-hidden="true" />
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </LayoutComandoDepartamental>
    );
}
