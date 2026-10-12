/**
 * DirectorioInstitucional.jsx — Directorio de Efectivos y Oficiales Policiales
 * Comando General de la Policía Boliviana
 * Diseño limpio, visual y estructurado en tarjetas de personal
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Users } from 'lucide-react';
import LayoutComandoGeneral from '../../js/components/LayoutComandoGeneral';
import Spinner from '../../js/components/ui/Spinner';
import AvatarFoto from '../../js/components/ui/AvatarFoto';
import Modal from '../../js/components/ui/Modal';
import { ChipsDato, EstadoVacio } from '../../js/components/ui/Graficos';
import api from '../../js/lib/api';

export default function DirectorioInstitucional() {
    const [oficiales, setOficiales] = useState([]);
    const [epis, setEpis] = useState([]);
    const [grados, setGrados] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [filtroEpi, setFiltroEpi] = useState('todas');
    const [filtroGrado, setFiltroGrado] = useState('todos');
    const [oficialModal, setOficialModal] = useState(null);

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);
                const [oficialesRes, episRes, gradosRes] = await Promise.all([
                    api.get('/oficiales'),
                    api.get('/epis'),
                    api.get('/grados'),
                ]);
                if (Array.isArray(oficialesRes)) setOficiales(oficialesRes);
                if (Array.isArray(episRes)) setEpis(episRes);
                if (Array.isArray(gradosRes)) setGrados(gradosRes);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const filtrados = useMemo(() => {
        return oficiales.filter((o) => {
            const q = busqueda.toLowerCase();
            const nombres = `${o.nombres || ''} ${o.apellidos || ''}`.toLowerCase();
            const ci = o.ci?.toLowerCase() || '';
            const escalafon = o.escalafon?.toLowerCase() || '';
            const grado = o.grado?.nombre?.toLowerCase() || '';
            const cargo = o.cargo?.nombre?.toLowerCase() || '';

            const coincideBusqueda = nombres.includes(q) || ci.includes(q) || escalafon.includes(q) || grado.includes(q) || cargo.includes(q);
            const coincideEpi = filtroEpi === 'todas' || String(o.id_epi) === String(filtroEpi);
            const coincideGrado = filtroGrado === 'todos' || String(o.id_grado) === String(filtroGrado);

            return coincideBusqueda && coincideEpi && coincideGrado;
        });
    }, [oficiales, busqueda, filtroEpi, filtroGrado]);

    return (
        <LayoutComandoGeneral>
            <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 ofbol-page-enter">

                {/* ─ Header PolBol ─ */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="ofbol-display heading-balance">Directorio institucional de oficiales</h1>
                        <p className="ofbol-nota mt-2">
                            Escalafón del personal registrado en las 9 EPIs de La Paz.
                        </p>
                    </div>

                    <span className="ofbol-chip shrink-0 tabular-nums">
                        {oficiales.length} registrados
                    </span>
                </div>

                {/* ─ Filtros ─ */}
                <div className="ofbol-card p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--ofbol-muted)' }} aria-hidden="true" />
                            <input
                                type="search"
                                aria-label="Buscar por nombres, C.I. o escalafón"
                                placeholder="Buscar por nombres, C.I. o escalafón…"
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                className="ofbol-input w-full pl-9"
                            />
                        </div>

                        <select aria-label="Filtrar por EPI"
                            value={filtroEpi}
                            onChange={(e) => setFiltroEpi(e.target.value)}
                            className="ofbol-input"
                        >
                            <option value="todas">Todas las EPIs</option>
                            {epis.map((e) => (
                                <option key={e.id_epi} value={e.id_epi}>{e.nombre}</option>
                            ))}
                        </select>

                        <select aria-label="Filtro de filtroGrado"
                            value={filtroGrado}
                            onChange={(e) => setFiltroGrado(e.target.value)}
                            className="ofbol-input"
                        >
                            <option value="todos">Todos los Grados</option>
                            {grados.map((g) => (
                                <option key={g.id_grado} value={g.id_grado}>{g.nombre}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* ─ Grid de Tarjetas de Oficiales ─ */}
                {loading ? (
                    <div className="py-20 flex justify-center"><Spinner /></div>
                ) : filtrados.length === 0 ? (
                    <div className="ofbol-card p-4">
                        <EstadoVacio
                            icono={Users}
                            titulo="Sin oficiales"
                            nota="Ningún efectivo coincide con los criterios de búsqueda."
                        />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtrados.map((o) => (
                            <article
                                key={o.id_oficial}
                                className="ofbol-card p-5 flex flex-col justify-between gap-3"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="relative shrink-0">
                                        <AvatarFoto
                                            foto={o.foto}
                                            nombre={`${o.nombres} ${o.apellidos}`}
                                            iniciales={o.grado?.abreviatura || 'Of.'}
                                            className="w-10 h-10 rounded-[14px] text-xs"
                                            fallbackClassName="bg-[#33401f]"
                                        />
                                        <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-[#33401f] text-white text-[8px] font-black uppercase">
                                            {o.grado?.abreviatura || 'Of.'}
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-black text-slate-900 leading-snug truncate">
                                            {o.nombres} {o.apellidos}
                                        </p>
                                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                            {o.cargo?.nombre || 'Efectivo Policial'}
                                        </p>
                                        <p className="text-[10px] text-emerald-800 font-bold mt-1">
                                            {o.epi?.nombre || 'EPI'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--ofbol-line)' }}>
                                    <span className="ofbol-etiqueta font-mono">C.I. {o.ci}</span>
                                    <button
                                        type="button"
                                        onClick={() => setOficialModal(o)}
                                        className="text-xs font-bold hover:underline"
                                        style={{ color: 'var(--ofbol-olive)' }}
                                    >
                                        Ver ficha →
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}

                {/* ─ Modal Ficha Oficial ─ */}
                <Modal
                    open={!!oficialModal}
                    onClose={() => setOficialModal(null)}
                    title="Ficha Oficial de Personal"
                    size="md"
                >
                    {oficialModal && (
                        <div className="space-y-5">
                            <div className="flex items-center gap-3.5">
                                <AvatarFoto
                                    foto={oficialModal.foto}
                                    nombre={`${oficialModal.nombres} ${oficialModal.apellidos}`}
                                    iniciales={oficialModal.grado?.abreviatura || 'OF'}
                                    className="w-12 h-12 rounded-[14px] text-sm"
                                    fallbackClassName="bg-[#3d4a2c]"
                                />
                                <div className="min-w-0">
                                    <p className="text-sm font-black truncate" style={{ color: 'var(--ofbol-ink)' }}>
                                        {oficialModal.nombres} {oficialModal.apellidos}
                                    </p>
                                    <p className="ofbol-etiqueta mt-0.5">{oficialModal.grado?.nombre || 'Oficial'}</p>
                                </div>
                            </div>

                            <ChipsDato
                                datos={[
                                    { etiqueta: 'Cédula de identidad', valor: oficialModal.ci ?? '—' },
                                    { etiqueta: 'Escalafón', valor: oficialModal.escalafon || '—' },
                                    { etiqueta: 'Unidad asignada', valor: oficialModal.epi?.nombre ?? '—' },
                                    { etiqueta: 'Cargo actual', valor: oficialModal.cargo?.nombre || 'Efectivo' },
                                ]}
                            />
                        </div>
                    )}
                </Modal>
            </div>
        </LayoutComandoGeneral>
    );
}
