/**
 * Notificaciones — bandeja de notificaciones del Secretario EPI (UI modernizada)
 * Conecta con:
 *   - NotificacionController → GET /api/notificaciones?id_usuario=X
 *   - NotificacionController → PUT /api/notificaciones/{id} (marcar como leída)
 */
import React, { useEffect, useState, useMemo } from 'react';
import { Bell, Check, Clock, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import LayoutSecretario from '../../js/components/LayoutSecretario';
import Spinner from '../../js/components/ui/Spinner';
import Alert from '../../js/components/ui/Alert';
import { useAuth } from '../../js/context/AuthContext';
import api from '../../js/lib/api';

function tiempoRelativo(fecha) {
    if (!fecha) return 'Recientemente';
    const diff = Date.now() - new Date(fecha).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'Hace un momento';
    if (min < 60) return `Hace ${min} min`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `Hace ${hrs} hora${hrs > 1 ? 's' : ''}`;
    const dias = Math.floor(hrs / 24);
    if (dias < 30) return `Hace ${dias} día${dias > 1 ? 's' : ''}`;
    return new Date(fecha).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Inferir el tipo visual a partir del contenido de la notificación
function tipoNotif(n) {
    const texto = `${n.titulo || ''} ${n.mensaje || ''}`.toLowerCase();
    if (texto.includes('observad') || texto.includes('devuelto')) {
        return { Icono: AlertTriangle, chip: 'bg-red-50 text-red-700 border-red-200', icon: 'bg-red-100 text-red-700' };
    }
    if (texto.includes('revisi')) {
        return { Icono: Clock, chip: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'bg-amber-100 text-amber-700' };
    }
    if (texto.includes('registrad') || texto.includes('aprobad')) {
        return { Icono: Check, chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'bg-emerald-100 text-emerald-700' };
    }
    return { Icono: Bell, chip: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'bg-blue-100 text-blue-700' };
}

export default function Notificaciones() {
    const { user } = useAuth();
    const [notificaciones, setNotificaciones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filtro, setFiltro] = useState('todas'); // 'todas' | 'no_leidas' | 'leidas'
    const [busqueda, setBusqueda] = useState('');
    const [marcandoId, setMarcandoId] = useState(null);

    const cargarNotificaciones = async () => {
        setLoading(true);
        try {
            const params = user?.id_usuario ? `?id_usuario=${user.id_usuario}` : '';
            const data = await api.get(`/notificaciones${params}`);
            setNotificaciones(Array.isArray(data) ? data : []);
        } catch (err) {
            setError('No se pudieron cargar las notificaciones.');
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

    const marcarComoLeida = async (notif) => {
        if (notif.leido) return;
        setMarcandoId(notif.id_notificacion);
        try {
            await api.put(`/notificaciones/${notif.id_notificacion}`, {
                ...notif,
                leido: true,
            });
            setNotificaciones((prev) =>
                prev.map((n) =>
                    n.id_notificacion === notif.id_notificacion ? { ...n, leido: true } : n
                )
            );
        } catch (err) {
            console.error('Error al marcar como leída', err);
        } finally {
            setMarcandoId(null);
        }
    };

    const marcarTodasComoLeidas = async () => {
        const noLeidas = notificaciones.filter((n) => !n.leido);
        if (noLeidas.length === 0) return;

        setLoading(true);
        try {
            await Promise.all(
                noLeidas.map((n) =>
                    api.put(`/notificaciones/${n.id_notificacion}`, {
                        ...n,
                        leido: true,
                    })
                )
            );
            setNotificaciones((prev) => prev.map((n) => ({ ...n, leido: true })));
        } catch (err) {
            setError('Error al marcar todas las notificaciones.');
        } finally {
            setLoading(false);
        }
    };

    const filtradas = useMemo(() => {
        let list = [...notificaciones];

        if (filtro === 'no_leidas') {
            list = list.filter((n) => !n.leido);
        } else if (filtro === 'leidas') {
            list = list.filter((n) => n.leido);
        }

        if (busqueda.trim()) {
            const q = busqueda.toLowerCase();
            list = list.filter(
                (n) =>
                    n.titulo?.toLowerCase().includes(q) ||
                    n.mensaje?.toLowerCase().includes(q) ||
                    n.documento?.codigo_documento?.toLowerCase().includes(q)
            );
        }

        return list;
    }, [notificaciones, filtro, busqueda]);

    const noLeidasCount = notificaciones.filter((n) => !n.leido).length;

    return (
        <LayoutSecretario notifCount={noLeidasCount}>
            <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6 ofbol-page-enter">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="ofbol-display heading-balance">Bandeja de Notificaciones</h1>
                        <p className="text-sm text-slate-500 mt-1">
                            Avisos institucionales, observaciones y actualizaciones de estado.
                        </p>
                    </div>

                    {noLeidasCount > 0 && (
                        <button
                            onClick={marcarTodasComoLeidas}
                            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition-colors self-start sm:self-auto"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Marcar todas como leídas
                        </button>
                    )}
                </div>

                {error && <Alert type="warning" onClose={() => setError(null)}>{error}</Alert>}

                {/* Filtros y búsqueda */}
                <div className="bg-white rounded-[14px] border border-slate-100 p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl text-xs font-medium text-slate-600">
                        <button
                            onClick={() => setFiltro('todas')}
                            className={`px-3 py-1.5 rounded-lg transition-colors ${filtro === 'todas' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'hover:text-slate-900'}`}
                        >
                            Todas ({notificaciones.length})
                        </button>
                        <button
                            onClick={() => setFiltro('no_leidas')}
                            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${filtro === 'no_leidas' ? 'bg-white text-emerald-800 shadow-sm font-semibold' : 'hover:text-slate-900'}`}
                        >
                            No leídas
                            {noLeidasCount > 0 && (
                                <span className="px-1.5 py-0.2 bg-red-500 text-white rounded-full text-[10px]">
                                    {noLeidasCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setFiltro('leidas')}
                            className={`px-3 py-1.5 rounded-lg transition-colors ${filtro === 'leidas' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'hover:text-slate-900'}`}
                        >
                            Leídas
                        </button>
                    </div>

                    <div className="relative flex-1 min-w-[200px] max-w-xs">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input aria-label="Buscar en avisos..."
                            type="text"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar en avisos..."
                            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3d4a2c] placeholder-slate-400"
                        />
                    </div>
                </div>

                {/* Tarjetas de notificaciones */}
                {loading ? (
                    <div className="flex items-center justify-center h-48">
                        <Spinner />
                    </div>
                ) : filtradas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                        <div className="w-12 h-12 rounded-[14px] bg-slate-50 flex items-center justify-center text-slate-300">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                        </div>
                        <p className="text-sm font-medium text-slate-500">No hay notificaciones para mostrar</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filtradas.map((notif) => {
                            const tipo = tipoNotif(notif);
                            return (
                                <div
                                    key={notif.id_notificacion}
                                    className={`bg-white rounded-[14px] border p-4 transition-colors ${!notif.leido ? 'border-slate-200' : 'border-slate-100 opacity-70'}`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tipo.icon}`}>
                                            <tipo.Icono size={18} strokeWidth={1.9} aria-hidden="true" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className={`text-sm truncate ${!notif.leido ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                                                    {notif.titulo}
                                                </p>
                                                {!notif.leido && <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />}
                                            </div>
                                            <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2">
                                                {notif.mensaje}
                                            </p>
                                            <div className="flex items-center justify-between mt-2.5">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${tipo.chip}`}>
                                                    {tiempoRelativo(notif.fecha)}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    {notif.id_documento && (
                                                        <Link
                                                            to="/secretario/mis-documentos"
                                                            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
                                                        >
                                                            Ver detalle →
                                                        </Link>
                                                    )}
                                                    {!notif.leido && (
                                                        <button
                                                            onClick={() => marcarComoLeida(notif)}
                                                            disabled={marcandoId === notif.id_notificacion}
                                                            title="Marcar como leída"
                                                            className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-100/60 rounded-lg transition-colors"
                                                        >
                                                            {marcandoId === notif.id_notificacion ? (
                                                                <Spinner size="sm" />
                                                            ) : (
                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </LayoutSecretario>
    );
}
