/**
 * RegistroDocumental.jsx — Libro de Registro Documental y Archivo Central
 * Comando General de la Policía Boliviana
 * Diseño limpio, visual y conciso (PolBol / Claude design)
 */
import React, { useState, useEffect, useMemo } from 'react';
import LayoutComandoGeneral from '../../js/components/LayoutComandoGeneral';
import EstadoBadge from '../../js/components/ui/EstadoBadge';
import Spinner from '../../js/components/ui/Spinner';
import Alert from '../../js/components/ui/Alert';
import Modal from '../../js/components/ui/Modal';
import api from '../../js/lib/api';

export default function RegistroDocumental() {
    const [documentos, setDocumentos] = useState([]);
    const [epis, setEpis] = useState([]);
    const [tipos, setTipos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [filtroEpi, setFiltroEpi] = useState('todas');
    const [filtroTipo, setFiltroTipo] = useState('todos');
    const [filtroEstado, setFiltroEstado] = useState('todos');
    const [mensaje, setMensaje] = useState(null);
    const [docModal, setDocModal] = useState(null);

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);
                const [docsRes, episRes, tiposRes] = await Promise.all([
                    api.get('/documentos'),
                    api.get('/epis'),
                    api.get('/tipos-documento'),
                ]);
                if (Array.isArray(docsRes)) setDocumentos(docsRes);
                if (Array.isArray(episRes)) setEpis(episRes);
                if (Array.isArray(tiposRes)) setTipos(tiposRes);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const filtrados = useMemo(() => {
        return documentos.filter((d) => {
            const q = busqueda.toLowerCase();
            const codigo = d.codigo_documento?.toLowerCase() || '';
            const oficial = `${d.oficial?.nombres || ''} ${d.oficial?.apellidos || ''}`.toLowerCase();
            const ci = d.oficial?.ci?.toLowerCase() || '';
            const referencia = d.referencia?.toLowerCase() || '';

            const coincideBusqueda = codigo.includes(q) || oficial.includes(q) || ci.includes(q) || referencia.includes(q);
            const coincideEpi = filtroEpi === 'todas' || String(d.id_epi) === String(filtroEpi);
            const coincideTipo = filtroTipo === 'todos' || String(d.id_tipo) === String(filtroTipo);

            const st = (d.estado?.nombre || '').toLowerCase();
            const coincideEstado =
                filtroEstado === 'todos' ||
                (filtroEstado === 'registrado' && st.includes('registrado')) ||
                (filtroEstado === 'pendiente' && !st.includes('registrado') && !st.includes('observ')) ||
                (filtroEstado === 'observado' && st.includes('observ'));

            return coincideBusqueda && coincideEpi && coincideTipo && coincideEstado;
        }).toSorted((a, b) => new Date(b.fecha_subida) - new Date(a.fecha_subida));
    }, [documentos, busqueda, filtroEpi, filtroTipo, filtroEstado]);

    const handleExportarLibro = () => {
        const csvRows = [
            ['NRO', 'CODIGO_MEMO', 'TIPO_TRAMITE', 'OFICIAL', 'CI', 'GRADO', 'EPI_ORIGEN', 'FECHA', 'ESTADO', 'HASH_SHA256'],
            ...filtrados.map((d, i) => [
                i + 1,
                `"${d.codigo_documento}"`,
                `"${d.tipo_documento?.nombre || ''}"`,
                `"${d.oficial?.nombres || ''} ${d.oficial?.apellidos || ''}"`,
                `"${d.oficial?.ci || ''}"`,
                `"${d.oficial?.grado?.nombre || ''}"`,
                `"${d.epi?.nombre || ''}"`,
                `"${d.fecha_subida || ''}"`,
                `"${d.estado?.nombre || ''}"`,
                `"${d.hash || ''}"`,
            ]),
        ];

        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + csvRows.map((e) => e.join(';')).join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Libro_Registro_ComandoGeneral_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setMensaje({
            tipo: 'success',
            texto: 'Libro de registro exportado correctamente.',
        });
    };

    const stats = useMemo(() => {
        const total = documentos.length;
        const registrados = documentos.filter((d) => (d.estado?.nombre || '').toLowerCase().includes('registrado')).length;
        const enTramite = total - registrados;
        return { total, registrados, enTramite };
    }, [documentos]);

    return (
        <LayoutComandoGeneral>
            <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 ofbol-page-enter">

                {/* ─ Header ─ */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#e6efec] text-[#2a351a] border border-[#cbe4df]">
                                Archivo Central
                            </span>
                            <span className="text-xs text-slate-400">· Libro de Registro Oficial</span>
                        </div>
                        <h1 className="ofbol-display heading-balance">
                            Registro Documental Oficial
                        </h1>
                    </div>

                    <button
                        onClick={handleExportarLibro}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#33401f] hover:bg-[#0f312c] text-white text-xs font-black rounded-xl transition-colors shadow-sm self-start sm:self-auto"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Exportar Libro (CSV)
                    </button>
                </div>

                {mensaje && (
                    <Alert
                        type={mensaje.tipo}
                        onClose={() => setMensaje(null)}
                    >
                        {mensaje.texto}
                    </Alert>
                )}

                {/* ─ 3 Métricas Rápidas ─ */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white rounded-[14px] p-4 border border-slate-100">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total en Archivo</p>
                        <p className="text-2xl font-black text-slate-900 mt-1">{stats.total}</p>
                    </div>
                    <div className="bg-white rounded-[14px] p-4 border border-slate-100">
                        <p className="text-[10px] font-black uppercase tracking-wider text-teal-700">Registrados Oficiales</p>
                        <p className="text-2xl font-black text-teal-900 mt-1">{stats.registrados}</p>
                    </div>
                    <div className="bg-white rounded-[14px] p-4 border border-slate-100">
                        <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">En Curso / Revisión</p>
                        <p className="text-2xl font-black text-amber-900 mt-1">{stats.enTramite}</p>
                    </div>
                </div>

                {/* ─ Filtros ─ */}
                <div className="bg-white rounded-[14px] p-4 border border-slate-100 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="relative">
                            <input aria-label="Buscar por memo, oficial, CI..."
                                type="text"
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                placeholder="Buscar por memo, oficial, CI..."
                                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3d4a2c]"
                            />
                            <svg className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>

                        <select aria-label="Filtrar por EPI"
                            value={filtroEpi}
                            onChange={(e) => setFiltroEpi(e.target.value)}
                            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3d4a2c]"
                        >
                            <option value="todas">Todas las EPIs</option>
                            {epis.map((e) => (
                                <option key={e.id_epi} value={e.id_epi}>{e.nombre}</option>
                            ))}
                        </select>

                        <select aria-label="Filtrar por tipo"
                            value={filtroTipo}
                            onChange={(e) => setFiltroTipo(e.target.value)}
                            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3d4a2c]"
                        >
                            <option value="todos">Todos los Tipos</option>
                            {tipos.map((t) => (
                                <option key={t.id_tipo} value={t.id_tipo}>{t.nombre}</option>
                            ))}
                        </select>

                        <select aria-label="Filtrar por estado"
                            value={filtroEstado}
                            onChange={(e) => setFiltroEstado(e.target.value)}
                            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3d4a2c]"
                        >
                            <option value="todos">Todos los Estados</option>
                            <option value="registrado">Registrados (Cerrados)</option>
                            <option value="pendiente">En Curso</option>
                            <option value="observado">Observados</option>
                        </select>
                    </div>
                </div>

                {/* ─ Tabla de Registro ─ */}
                <div className="bg-white rounded-[14px] border border-slate-100 overflow-hidden">
                    {loading ? (
                        <div className="py-20 flex justify-center"><Spinner /></div>
                    ) : filtrados.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 space-y-1">
                            <p className="text-xs font-bold">No se encontraron documentos</p>
                            <p className="text-[10px]">Ajuste los filtros de búsqueda</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                        <th className="px-5 py-3.5">Código / Trámite</th>
                                        <th className="px-5 py-3.5">Oficial Destinatario</th>
                                        <th className="px-5 py-3.5">EPI Origen</th>
                                        <th className="px-5 py-3.5">Fecha</th>
                                        <th className="px-5 py-3.5">Estado</th>
                                        <th className="px-5 py-3.5 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filtrados.map((doc) => (
                                        <tr key={doc.id_documento} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <p className="font-mono font-black text-slate-900">{doc.codigo_documento}</p>
                                                <p className="text-[11px] text-slate-500 truncate max-w-xs">{doc.referencia}</p>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <p className="font-bold text-slate-900">
                                                    {doc.oficial?.grado?.abreviatura ? `${doc.oficial.grado.abreviatura} ` : ''}
                                                    {doc.oficial?.nombres} {doc.oficial?.apellidos}
                                                </p>
                                                <p className="text-[10px] text-slate-400">CI: {doc.oficial?.ci || '—'}</p>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className="px-2 py-0.5 rounded-lg bg-slate-100 font-bold text-slate-700 border border-slate-200">
                                                    {doc.epi?.nombre || 'EPI'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                                                {doc.fecha_subida ? new Date(doc.fecha_subida).toLocaleDateString('es-BO') : '—'}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <EstadoBadge nombre={doc.estado?.nombre || 'En trámite'} />
                                            </td>
                                            <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                                <button
                                                    onClick={() => setDocModal(doc)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                                                >
                                                    Ver Ficha →
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* ─ Modal Ficha Documental ─ */}
                <Modal
                    open={!!docModal}
                    onClose={() => setDocModal(null)}
                    title={`Ficha Documental: ${docModal?.codigo_documento || ''}`}
                    size="lg"
                >
                    {docModal && (
                        <div className="space-y-4">
                            <div className="bg-slate-900 rounded-[14px] p-4 text-white flex items-center justify-between">
                                <div>
                                    <span className="font-mono text-sm font-black text-emerald-300">{docModal.codigo_documento}</span>
                                    <p className="text-xs text-slate-300">{docModal.referencia}</p>
                                </div>
                                <a
                                    href={`/storage/${docModal.ruta_pdf}`}
                                    download
                                    className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20"
                                >
                                    Descargar PDF
                                </a>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <p className="text-[10px] uppercase font-bold text-slate-400">Oficial</p>
                                    <p className="font-bold text-slate-900 mt-0.5">{docModal.oficial?.nombres} {docModal.oficial?.apellidos}</p>
                                    <p className="text-[10px] text-slate-400">CI: {docModal.oficial?.ci} · Esc: {docModal.oficial?.escalafon}</p>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <p className="text-[10px] uppercase font-bold text-slate-400">EPI de Origen</p>
                                    <p className="font-bold text-slate-900 mt-0.5">{docModal.epi?.nombre}</p>
                                    <p className="text-[10px] text-slate-400">Secretario: {docModal.usuario?.usuario}</p>
                                </div>
                            </div>

                            <div className="bg-slate-900 rounded-[14px] overflow-hidden">
                                <iframe
                                    src={`/storage/${docModal.ruta_pdf}`}
                                    className="w-full h-64 bg-slate-800"
                                    title="PDF"
                                />
                            </div>
                        </div>
                    )}
                </Modal>
            </div>
        </LayoutComandoGeneral>
    );
}
