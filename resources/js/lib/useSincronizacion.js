/**
 * useSincronizacion — Motor del MODO EN VIVO de OFBOL.
 *
 * Sondea /api/sync/estado cada pocos segundos y notifica a la página:
 *   - nuevos documentos creados (subidos por una EPI en otra ventana)
 *   - cambios de estado de documentos (revisados/observados/aprobados)
 *   - solicitudes de registro nuevas o resueltas (panel IA)
 *   - resumen por EPI (para el campus de edificios)
 *
 * Optimizado para carga y red:
 *   - Pausa total cuando la pestaña está oculta (visibilitychange).
 *   - Filtro por EPI opcional: las unidades solo escuchan SU estación
 *     (los eventos de otras EPIs no generan toasts ni re-renders).
 *
 * Devuelve { conectado, ultimoChequeo, resumenEpi } y dispara
 * onDocumento/onSolicitud con los eventos detectados.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import api from './api';

const INTERVALO_MS = 5000;

export default function useSincronizacion({ onDocumento, onSolicitud, activo = true, idEpi = null } = {}) {
    const [conectado, setConectado] = useState(null); // null = conectando...
    const [ultimoChequeo, setUltimoChequeo] = useState(null);
    const [resumenEpi, setResumenEpi] = useState([]);

    const desdeRef = useRef(null);
    const docsPreviosRef = useRef(null); // {id: estado} de la pasada anterior
    const solPreviasRef = useRef(null);  // {id: estado_solicitud|ia_estado}
    const idEpiRef = useRef(idEpi);
    useEffect(() => {
        idEpiRef.current = idEpi;
    }, [idEpi]);

    const vivosRef = useRef({ onDocumento, onSolicitud });
    useEffect(() => {
        vivosRef.current = { onDocumento, onSolicitud };
    }, [onDocumento, onSolicitud]);

    const consultar = useCallback(async () => {
        try {
            const params = desdeRef.current ? `?desde=${encodeURIComponent(desdeRef.current)}` : '';
            const data = await api.get(`/sync/estado${params}`);
            desdeRef.current = data.servidor_hora;
            setConectado(true);
            setUltimoChequeo(new Date());

            // ── Resumen por EPI para el campus visual ──
            if (Array.isArray(data.resumen_epi)) {
                setResumenEpi(data.resumen_epi);
            }

            // ── Detectar documentos creados / movidos ──
            if (Array.isArray(data.documentos)) {
                const actuales = {};
                data.documentos.forEach((d) => {
                    actuales[d.id_documento] = d.estado_actual;
                });

                // Primera pasada: solo tomar foto (no spamear eventos viejos).
                if (docsPreviosRef.current !== null) {
                    const previos = docsPreviosRef.current;
                    const eventos = [];
                    data.documentos.forEach((d) => {
                        // Filtro por unidad: fuera de la EPI propia no notifica.
                        if (idEpiRef.current != null && Number(d.id_epi) !== Number(idEpiRef.current)) return;
                        const antes = previos[d.id_documento];
                        if (antes === undefined) {
                            eventos.push({ tipo: 'creado', ...d });
                        } else if (String(antes) !== String(d.estado_actual)) {
                            eventos.push({ tipo: 'estado', antes, ...d });
                        }
                    });
                    if (eventos.length && vivosRef.current.onDocumento) {
                        vivosRef.current.onDocumento(eventos);
                    }
                }
                docsPreviosRef.current = actuales;
            }

            // ── Detectar solicitudes nuevas / resueltas ──
            if (Array.isArray(data.solicitudes)) {
                const actuales = {};
                data.solicitudes.forEach((s) => {
                    actuales[s.id_solicitud] = `${s.estado_solicitud}|${s.ia_estado ?? ''}`;
                });
                if (solPreviasRef.current !== null) {
                    const previos = solPreviasRef.current;
                    const eventos = [];
                    data.solicitudes.forEach((s) => {
                        const antes = previos[s.id_solicitud];
                        const ahora = actuales[s.id_solicitud];
                        if (antes === undefined) {
                            eventos.push({ tipo: 'nueva', ...s });
                        } else if (antes !== ahora) {
                            eventos.push({ tipo: 'actualizada', ...s });
                        }
                    });
                    if (eventos.length && vivosRef.current.onSolicitud) {
                        vivosRef.current.onSolicitud(eventos);
                    }
                }
                solPreviasRef.current = actuales;
            }
        } catch {
            setConectado(false);
        }
    }, []);

    useEffect(() => {
        if (!activo) return undefined;
        let enCurso = false;
        let intervalo = null;

        const sondeo = () => {
            // Ahorro real: mientras la pestaña no está visible no hay red,
            // no hay renders y no hay procesamiento. Al volver, se sondea.
            if (enCurso || document.hidden) return;
            enCurso = true;
            consultar().finally(() => {
                enCurso = false;
            });
        };

        const onVisible = () => {
            if (!document.hidden) sondeo();
        };

        sondeo();
        intervalo = setInterval(sondeo, INTERVALO_MS);
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            clearInterval(intervalo);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [activo, consultar]);

    return { conectado, ultimoChequeo, resumenEpi, refrescar: consultar };
}
