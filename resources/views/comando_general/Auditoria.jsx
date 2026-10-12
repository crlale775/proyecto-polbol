/**
 * Auditoria.jsx — Registro de Actividad Institucional
 * Comando General de la Policía Boliviana
 * Bitácora inmutable de operaciones, logins y dictámenes
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Download, Search, ShieldCheck } from 'lucide-react';
import LayoutComandoGeneral from '../../js/components/LayoutComandoGeneral';
import Spinner from '../../js/components/ui/Spinner';
import Alert from '../../js/components/ui/Alert';
import { EstadoVacio } from '../../js/components/ui/Graficos';
import api from '../../js/lib/api';

export default function Auditoria() {
    const [auditorias, setAuditorias] = useState([]);
    const [epis, setEpis] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [filtroAccion, setFiltroAccion] = useState('todas');
    const [filtroInstancia, setFiltroInstancia] = useState('todas');
    const [filtroEpi, setFiltroEpi] = useState('');
    const [mensaje, setMensaje] = useState(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [res, episRes] = await Promise.all([
                api.get('/auditorias'),
                api.get('/epis').catch(() => []),
            ]);
            if (Array.isArray(res)) setAuditorias(res);
            if (Array.isArray(episRes)) setEpis(episRes);
        } catch (err) {
            setMensaje({ tipo: 'error', texto: 'No se pudieron cargar los registros de actividad.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filtrados = useMemo(() => {
        return auditorias.filter((a) => {
            const q = busqueda.toLowerCase();
            const descripcion = a.descripcion?.toLowerCase() || '';
            const usuario = a.usuario?.usuario?.toLowerCase() || '';
            const tabla = a.tabla?.toLowerCase() || '';
            const accion = a.accion?.toLowerCase() || '';
            const rolNombre = (a.usuario?.rol?.nombre || '').toLowerCase();
            const epiId = a.usuario?.epi?.id_epi;

            const coincideBusqueda = descripcion.includes(q) || usuario.includes(q) || tabla.includes(q) || accion.includes(q);
            const coincideAccion = filtroAccion === 'todas' || a.accion === filtroAccion;

            const coincideInstancia =
                filtroInstancia === 'todas' ||
                (filtroInstancia === 'epi' && (rolNombre.includes('secretario') || rolNombre.includes('epi'))) ||
                (filtroInstancia === 'departamental' && (rolNombre.includes('departamental') || rolNombre.includes('comando d'))) ||
                (filtroInstancia === 'general' && (rolNombre.includes('general') || rolNombre.includes('comando g')));

            const coincideEpi = !filtroEpi || epiId === parseInt(filtroEpi);

            return coincideBusqueda && coincideAccion && coincideInstancia && coincideEpi;
        });
    }, [auditorias, busqueda, filtroAccion, filtroInstancia, filtroEpi]);

    const handleExportarActividad = () => {
        const csvRows = [
            ['ID', 'FECHA', 'USUARIO', 'ROL', 'INSTANCIA', 'ACCION', 'MODULO', 'DESCRIPCION'],
            ...filtrados.map((a) => [
                a.id_auditoria,
                `"${a.fecha || ''}"`,
                `"${a.usuario?.usuario || 'Sistema'}"`,
                `"${a.usuario?.rol?.nombre || ''}"`,
                `"${a.usuario?.epi?.nombre || 'Central'}"`,
                `"${a.accion || ''}"`,
                `"${a.tabla || ''}"`,
                `"${(a.descripcion || '').replace(/"/g, '""')}"`,
            ]),
        ];

        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + csvRows.map((e) => e.join(';')).join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Registro_Actividad_PolBol_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setMensaje({ tipo: 'success', texto: 'Registro de actividad exportado correctamente.' });
    };

    return (
        <LayoutComandoGeneral>
            <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 ofbol-page-enter">

                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="ofbol-display heading-balance">Registro de actividad institucional</h1>
                        <p className="ofbol-nota mt-2">
                            Bitácora inmutable de operaciones: accesos, dictámenes y movimientos del flujo documental.
                        </p>
                    </div>

                    <button type="button" onClick={handleExportarActividad} className="ofbol-btn-primary shrink-0">
                        <Download size={15} />
                        Exportar CSV
                    </button>
                </div>

                {mensaje && <Alert type={mensaje.tipo} onClose={() => setMensaje(null)}>{mensaje.texto}</Alert>}

                {/* ─ Filtros ─ */}
                <div className="ofbol-card p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--ofbol-muted)' }} aria-hidden="true" />
                            <input
                                type="search"
                                aria-label="Buscar por usuario, acción o módulo"
                                placeholder="Buscar por usuario, acción o módulo…"
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                className="ofbol-input w-full pl-9"
                            />
                        </div>

                        <select aria-label="Filtrar por instancia"
                            value={filtroInstancia}
                            onChange={(e) => setFiltroInstancia(e.target.value)}
                            className="ofbol-input"
                        >
                            <option value="todas">Todas las Instancias</option>
                            <option value="epi">Secretaría EPI</option>
                            <option value="departamental">Comando Departamental</option>
                            <option value="general">Comando General</option>
                        </select>

                        <select aria-label="Filtrar por accion"
                            value={filtroAccion}
                            onChange={(e) => setFiltroAccion(e.target.value)}
                            className="ofbol-input"
                        >
                            <option value="todas">Todas las Acciones</option>
                            <option value="LOGIN">LOGIN</option>
                            <option value="SUBIDA_DOCUMENTO">SUBIDA_DOCUMENTO</option>
                            <option value="APROBACION_REVISION">APROBACION_REVISION</option>
                            <option value="OBSERVACION_TRAMITE">OBSERVACION_TRAMITE</option>
                            <option value="REGISTRO_FINAL">REGISTRO_FINAL</option>
                        </select>

                        <select aria-label="Filtrar por EPI"
                            value={filtroEpi}
                            onChange={(e) => setFiltroEpi(e.target.value)}
                            className="ofbol-input"
                        >
                            <option value="">Todas las EPIs</option>
                            {epis.map((e) => (
                                <option key={e.id_epi} value={e.id_epi}>{e.nombre}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* ─ Tabla de Eventos ─ */}
                <div className="ofbol-card overflow-hidden">
                    {loading ? (
                        <div className="py-20 flex justify-center"><Spinner /></div>
                    ) : filtrados.length === 0 ? (
                        <div className="p-4">
                            <EstadoVacio
                                icono={ShieldCheck}
                                titulo="Sin eventos"
                                nota="Ningún registro coincide con los filtros aplicados."
                            />
                        </div>
                    ) : (
                        <div className="overflow-x-auto ofbol-scroll">
                            <table className="ofbol-table">
                                <thead>
                                    <tr>
                                        <th># ID</th>
                                        <th>Fecha y hora</th>
                                        <th>Operador</th>
                                        <th>Instancia</th>
                                        <th>Acción</th>
                                        <th>Descripción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtrados.map((a) => {
                                        const rolNom = a.usuario?.rol?.nombre || '';
                                        const esEpi = rolNom.toLowerCase().includes('secretario') || rolNom.toLowerCase().includes('epi');
                                        const esDptal = rolNom.toLowerCase().includes('departamental');

                                        return (
                                            <tr key={a.id_auditoria}>
                                                <td className="font-mono tabular-nums" style={{ color: 'var(--ofbol-muted)' }}>#{a.id_auditoria}</td>
                                                <td className="font-mono whitespace-nowrap">
                                                    {a.fecha ? new Date(a.fecha).toLocaleString('es-BO') : '—'}
                                                </td>
                                                <td className="font-bold">{a.usuario?.usuario || 'Sistema'}</td>
                                                <td>
                                                    <span className={`ofbol-badge ${
                                                        esEpi ? 'ofbol-badge--teal' : esDptal ? 'ofbol-badge--amber' : 'ofbol-badge--olive'
                                                    }`}>
                                                        {rolNom || 'Central'}
                                                    </span>
                                                </td>
                                                <td className="font-mono text-[11px] font-bold">{a.accion}</td>
                                                <td className="max-w-sm truncate">{a.descripcion}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </LayoutComandoGeneral>
    );
}
