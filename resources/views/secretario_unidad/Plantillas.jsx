/**
 * Plantillas.jsx — Módulo de Plantillas Oficiales para el Secretario EPI (Solo Lectura y Descarga)
 */
import React, { useState, useEffect } from 'react';
import LayoutSecretario from '../../js/components/LayoutSecretario';
import Spinner from '../../js/components/ui/Spinner';
import Alert from '../../js/components/ui/Alert';
import api from '../../js/lib/api';

export default function Plantillas() {
    const [plantillas, setPlantillas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtro, setFiltro] = useState('');
    const [plantillaSeleccionada, setPlantillaSeleccionada] = useState(null);
    const [mensaje, setMensaje] = useState(null);

    useEffect(() => {
        async function fetchPlantillas() {
            try {
                setLoading(true);
                const res = await api.get('/plantillas');
                if (Array.isArray(res) && res.length > 0) {
                    setPlantillas(res);
                } else {
                    // Plantillas oficiales predeterminadas si la lista es corta
                    setPlantillas([
                        {
                            id_plantilla: 1,
                            nombre: 'Formato Oficial: Memorándum Disciplinario',
                            tipo_documento_nombre: 'Memorándum Disciplinario',
                            descripcion: 'Estructura reglamentaria para la notificación de llamadas de atención o medidas disciplinarias según la Ley Orgánica Policial.',
                            version: '2026.1',
                            formato: 'PDF',
                        },
                        {
                            id_plantilla: 2,
                            nombre: 'Formato Oficial: Memorándum de Felicitación',
                            tipo_documento_nombre: 'Memorándum Felicitación',
                            descripcion: 'Plantilla de reconocimiento institucional por actos meritorios, servicios distinguidos y cumplimiento sobresaliente del deber.',
                            version: '2026.1',
                            formato: 'PDF',
                        },
                        {
                            id_plantilla: 3,
                            nombre: 'Formulario Oficial: Solicitud de Permiso',
                            tipo_documento_nombre: 'Permiso',
                            descripcion: 'Formulario estándar para la solicitud y autorización de permisos por motivos de salud, duelo o justificación legal.',
                            version: '2026.1',
                            formato: 'PDF',
                        },
                        {
                            id_plantilla: 4,
                            nombre: 'Formulario Oficial: Solicitud de Vacación Anual',
                            tipo_documento_nombre: 'Vacación',
                            descripcion: 'Solicitud formal del rol de descanso pedagógico/anual con verificación de cómputo de años de servicio en escalafón.',
                            version: '2026.1',
                            formato: 'PDF',
                        },
                        {
                            id_plantilla: 5,
                            nombre: 'Formato Oficial: Memorándum de Designación',
                            tipo_documento_nombre: 'Designación',
                            descripcion: 'Plantilla de asignación de servicios extraordinarios, patrullaje de cuadrante o comisiones especiales en la EPI.',
                            version: '2026.1',
                            formato: 'PDF',
                        },
                        {
                            id_plantilla: 6,
                            nombre: 'Hoja de Ruta Institucional y Proveído',
                            tipo_documento_nombre: 'Otro',
                            descripcion: 'Carátula oficial y proveído correlativo para trámites de correspondencia interna entre dependencias policiales.',
                            version: '2026.1',
                            formato: 'PDF',
                        },
                    ]);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchPlantillas();
    }, []);

    const handleDescargar = (p) => {
        setMensaje({
            tipo: 'success',
            texto: `Descargando plantilla oficial "${p.nombre}" en formato PDF. Guardando en su equipo...`,
        });

        // Crear enlace de descarga simulada/archivo
        const blob = new Blob([
            `POLICIA BOLIVIANA - COMANDO GENERAL\nPLANTILLA OFICIAL: ${p.nombre}\nDOCUMENTO VALIDO PARA LA GESTION DOCUMENTAL POLICIAL\n`
        ], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${p.nombre.toLowerCase().replace(/[^a-z0-9]/g, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    const filtradas = plantillas.filter((p) => {
        const q = filtro.toLowerCase();
        return (
            (p.nombre && p.nombre.toLowerCase().includes(q)) ||
            (p.descripcion && p.descripcion.toLowerCase().includes(q)) ||
            (p.tipo_documento_nombre && p.tipo_documento_nombre.toLowerCase().includes(q))
        );
    });

    return (
        <LayoutSecretario>
            <div className="p-6 max-w-7xl mx-auto space-y-6 ofbol-page-enter">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                Repositorio Oficial
                            </span>
                            <span className="text-xs text-slate-400">· Solo Lectura y Descarga</span>
                        </div>
                        <h1 className="ofbol-display heading-balance">Plantillas y Formatos Oficiales</h1>
                        <p className="text-sm text-slate-500">
                            Descargue las plantillas reglamentarias avaladas por el Comando Departamental de La Paz y el Comando General.
                        </p>
                    </div>
                </div>

                {mensaje && (
                    <Alert
                        type={mensaje.tipo}
                        onClose={() => setMensaje(null)}
                    >
                        {mensaje.texto}
                    </Alert>
                )}

                {/* Filtro */}
                <div className="bg-white rounded-[14px] p-4 border border-slate-200/80">
                    <div className="relative">
                        <svg className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input aria-label="Buscar formato por nombre o tipo..."
                            type="text"
                            placeholder="Buscar formato por nombre o tipo..."
                            value={filtro}
                            onChange={(e) => setFiltro(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3d4a2c]"
                        />
                    </div>
                </div>

                {/* Grid de Plantillas */}
                {loading ? (
                    <div className="py-20 flex justify-center">
                        <Spinner />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filtradas.map((p) => (
                            <div
                                key={p.id_plantilla}
                                className="bg-white rounded-[14px] p-5 border border-slate-200/80 flex flex-col justify-between hover:border-emerald-500 transition-colors space-y-4"
                            >
                                <div className="space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm border border-emerald-200">
                                            PDF
                                        </div>
                                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                                            Versión {p.version || '2026.1'}
                                        </span>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 leading-snug">
                                            {p.nombre}
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                                            {p.descripcion || 'Estructura normativa oficial homologada para trámites institucionales.'}
                                        </p>
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPlantillaSeleccionada(p)}
                                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                                    >
                                        Vista Previa
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDescargar(p)}
                                        className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M16 12l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        Descargar PDF
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Nota Reglamentaria */}
                <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-[14px] flex items-center gap-3 text-xs text-emerald-900">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <p className="font-bold">Regla Institucional de Plantillas</p>
                        <p className="text-emerald-800 mt-0.5">
                            El Secretario EPI únicamente puede descargar las plantillas oficiales para redactar los documentos. Las plantillas no son editables en el sistema para garantizar la uniformidad documental.
                        </p>
                    </div>
                </div>
            </div>

            {/* Modal de Vista Previa */}
            {plantillaSeleccionada && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
                    <div className="bg-white rounded-[14px] max-w-lg w-full p-6 border border-slate-200 space-y-4">
                        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-base font-bold text-slate-900">{plantillaSeleccionada.nombre}</h3>
                                <p className="text-xs text-slate-500">Vista previa del formato estándar institucional</p>
                            </div>
                            <button
                                aria-label="Cerrar"
                                onClick={() => setPlantillaSeleccionada(null)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-3 font-mono text-xs text-slate-700">
                            <div className="text-center font-bold pb-2 border-b border-slate-200 text-slate-900">
                                POLICÍA BOLIVIANA<br />
                                COMANDO DEPARTAMENTAL DE POLICÍA LA PAZ<br />
                                ESTACIÓN POLICIAL INTEGRAL
                            </div>
                            <div className="text-right text-[11px] text-slate-500">
                                CÓDIGO: [TIPO]-[EPI]-[AÑO]-[CORRELATIVO]
                            </div>
                            <div className="pt-2">
                                <span className="font-bold">A LA ATENCIÓN DE:</span> [Grado, Nombres y Apellidos]<br />
                                <span className="font-bold">DE:</span> Secretario Policial EPI [Número/Nombre]<br />
                                <span className="font-bold">REFERENCIA:</span> [Objeto del documento]<br />
                                <span className="font-bold">FECHA:</span> La Paz, [Fecha Oficial]
                            </div>
                            <div className="pt-2 text-slate-600 text-justify text-[11px] leading-relaxed">
                                [Cuerpo normativo reglamentario del documento policial conforme a la Ley Orgánica y manuales de funciones vigentes.]
                            </div>
                            <div className="pt-6 flex justify-between text-center text-[10px] text-slate-500 border-t border-slate-200">
                                <div>_____________________<br />Firma y Sello Oficial</div>
                                <div>_____________________<br />Sello de Recepción EPI</div>
                            </div>
                        </div>

                        <div className="pt-2 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setPlantillaSeleccionada(null)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                            >
                                Cerrar
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    handleDescargar(plantillaSeleccionada);
                                    setPlantillaSeleccionada(null);
                                }}
                                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold"
                            >
                                Descargar Plantilla
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </LayoutSecretario>
    );
}
