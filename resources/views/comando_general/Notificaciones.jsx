/**
 * Notificaciones.jsx — Bandeja de Alertas del Comando General
 * Diseño limpio, visual y moderno (PolBol / Claude design)
 */
import React, { useEffect, useState, useMemo } from 'react';
import { Bell, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import LayoutComandoGeneral from '../../js/components/LayoutComandoGeneral';
import Spinner from '../../js/components/ui/Spinner';
import Alert from '../../js/components/ui/Alert';
import { useAuth } from '../../js/context/AuthContext';
import api from '../../js/lib/api';

export default function Notificaciones() {
    const { user } = useAuth();
    const [notificaciones, setNotificaciones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filtro, setFiltro] = useState('todas');
    const [busqueda, setBusqueda] = useState('');

    const cargar = async () => {
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
        cargar();
    }, [user]);

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
        <LayoutComandoGeneral>
            <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6 ofbol-page-enter">

                {/* ─ Header PolBol ─ */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#e6efec] text-[#2a351a] border border-[#cbe4df]">
                                Alertas Institucionales
                            </span>
                            <span className="text-xs text-slate-400">· Avisos de Trámites</span>
                        </div>
                        <h1 className="ofbol-display heading-balance">
                            Bandeja de Notificaciones
                        </h1>
                    </div>

                    {noLeidasCount > 0 && (
                        <button
                            onClick={marcarTodas}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#33401f] hover:bg-[#0f312c] text-white text-xs font-black rounded-xl transition-colors shadow-sm self-start sm:self-auto"
                        >
                            Marcar todas como leídas ({noLeidasCount})
                        </button>
                    )}
                </div>

                {error && <Alert type="error" onClose={() => setError(null)}>{error}</Alert>}

                {/* ─ Filtros ─ */}
                <div className="bg-white rounded-[14px] p-4 border border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex bg-slate-100 p-1 rounded-[14px] gap-1 shrink-0">
                        {[
                            { id: 'todas', label: 'Todas' },
                            { id: 'no_leidas', label: `No leídas (${noLeidasCount})` },
                            { id: 'leidas', label: 'Leídas' },
                        ].map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setFiltro(t.id)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                                    filtro === t.id
                                        ? 'bg-white text-slate-900'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <div className="relative flex-1 max-w-xs">
                        <input aria-label="Buscar avisos..."
                            type="text"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar avisos..."
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3d4a2c]"
                        />
                        <svg className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                {/* ─ Lista de Notificaciones ─ */}
                {loading ? (
                    <div className="py-20 flex justify-center"><Spinner /></div>
                ) : filtradas.length === 0 ? (
                    <div className="bg-white rounded-[14px] p-16 border border-slate-100 text-center text-slate-400 space-y-1">
                        <p className="text-xs font-bold">No hay notificaciones</p>
                        <p className="text-[10px]">Está al día con todos los avisos</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtradas.map((n) => (
                            <div
                                key={n.id_notificacion}
                                role="button"
                                tabIndex={0}
                                onClick={() => marcarComoLeida(n)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') marcarComoLeida(n); }}
                                className={`bg-white rounded-[14px] p-5 border transition-colors cursor-pointer flex items-start gap-4 ${ !n.leido ? 'border-emerald-300 ring-2 ring-emerald-100/70 ' : 'border-slate-100 opacity-80 hover:opacity-100' }`}
                            >
                                <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 ${
                                    !n.leido ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-500'
                                }`}>
                                    {!n.leido
                                        ? <Bell size={17} strokeWidth={2} aria-hidden="true" />
                                        : <Check size={17} strokeWidth={2.5} aria-hidden="true" />}
                                </div>

                                <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className={`text-xs ${!n.leido ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}>
                                            {n.titulo}
                                        </p>
                                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                            {n.fecha ? new Date(n.fecha).toLocaleString('es-BO') : '—'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        {n.mensaje}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </LayoutComandoGeneral>
    );
}
