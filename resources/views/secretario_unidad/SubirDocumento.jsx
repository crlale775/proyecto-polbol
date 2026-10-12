/**
 * SubirDocumento.jsx — Módulo de Registro y Carga de Documentos para el Secretario EPI
 * Incluye:
 *   - Selección de Oficial exclusivo de la EPI asignada mediante listado interactivo y búsqueda (CI, Escalafón, Nombre)
 *   - Autogeneración automática del Código de Memorándum institucional
 *   - Previsualizador en vivo del PDF abierto en panel lateral
 *   - Sistema Experto con revisión preventiva de contenido (sin tecnicismos de hash ni firmas visibles)
 */
import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Check, X, FileText, Users } from 'lucide-react';
import { ChipsDato, EstadoVacio } from '../../js/components/ui/Graficos';
import { SeccionPanel } from '../../js/components/ui/Panel';
import { useNavigate } from 'react-router-dom';
import LayoutSecretario from '../../js/components/LayoutSecretario';
import Alert from '../../js/components/ui/Alert';
import Modal from '../../js/components/ui/Modal';
import Spinner from '../../js/components/ui/Spinner';
import AvatarFoto from '../../js/components/ui/AvatarFoto';
import { useAuth } from '../../js/context/AuthContext';
import api from '../../js/lib/api';
import { useToast } from '../../js/components/ui/ToastEnVivo';

// Fecha de HOY en hora local. No usar toISOString() directo: a partir de las
// 20:00 (UTC-4, Bolivia) devuelve el DÍA SIGUIENTE y bloquearía el envío.
const hoyLocal = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
};

/**
 * Bloque — sección numerada del expediente.
 *
 * Un solo encabezado de sección en toda la vista (paso + título + metadato a
 * la derecha) en lugar de repetir el markup genérico en cada tarjeta. El
 * número es real: los pasos se completan en ese orden.
 */
function Bloque({ paso, titulo, meta, children }) {
    return (
        <section className="ofbol-card p-5">
            <header className="flex items-center justify-between gap-3 mb-4">
                <h2 className="flex items-center gap-2 min-w-0">
                    {paso != null && (
                        <span
                            className="ofbol-step"
                            style={paso === 0 ? { background: 'var(--ofbol-steel)' } : undefined}
                        >
                            {paso}
                        </span>
                    )}
                    <span className="ofbol-titulo-seccion truncate">{titulo}</span>
                </h2>
                {meta}
            </header>
            {children}
        </section>
    );
}

export default function SubirDocumento() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const mostrarToastGlobal = useToast();

    // Catálogos
    const [tipos, setTipos] = useState([]);
    const [estados, setEstados] = useState([]);
    const [oficiales, setOficiales] = useState([]);
    const [documentosExistentes, setDocumentosExistentes] = useState([]);
    const [cargandoCatalogos, setCargandoCatalogos] = useState(true);

    // Selección de Oficial (Solo de esta EPI)
    const [busquedaOficial, setBusquedaOficial] = useState('');
    const [oficialSeleccionado, setOficialSeleccionado] = useState(null);
    const [mostrarListaOficiales, setMostrarListaOficiales] = useState(false);

    // Archivo y Previsualización
    const [archivo, setArchivo] = useState(null);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [pdfTexto, setPdfTexto] = useState('');
    const [hashSilencioso, setHashSilencioso] = useState('');
    const [analizandoPdf, setAnalizandoPdf] = useState(false);

    // Revisión automática en vivo del PDF (servicio de verificación del sistema)
    const [revisionIA, setRevisionIA] = useState(null);
    const [revisandoIA, setRevisandoIA] = useState(false);
    const revisionEnCursoRef = useRef(false);

    // Modal de confirmación previa al envío
    const [confirmarEnvio, setConfirmarEnvio] = useState(false);
    // Casilla de asunción de responsabilidad: cuando la verificación detecta
    // problemas, el secretario debe marcarla conscientemente para habilitar
    // el envío. El modal NO bloquea, solo exige confirmación explícita.
    const [aceptoResponsabilidad, setAceptoResponsabilidad] = useState(false);

    // Formulario
    const [form, setForm] = useState({
        id_tipo: '',
        tipo_libre: '',          // solo cuando id_tipo === 'otro-libre'
        codigo_documento: '',
        referencia: '',
        descripcion: '',
        fecha_subida: hoyLocal(),
    });

    // IDs de los tipos comunes (coinciden con la BD en el orden insertado)
    // Mapeamos por nombre para no depender del ID numérico
    const TIPOS_COMUNES_NOMBRES = [
        'Designación',
        'Llamada de Atención',
        'Arresto',
        'Vacación',
        'Cuenta Vacación',
        'Comisión de Estudio',
        'Cambio de Destino',
    ];

    /**
     * Valida que un texto no sea "basura" (solo caracteres aleatorios sin
     * apariencia de texto real). Se usa para el campo libre de "Otros".
     */
    const textoEsBasura = (text) => {
        if (!text) return true;
        const s = text.trim();
        if (s.length < 3) return true;
        // Si no hay al menos 2 vocales o no hay ninguna letra círvula común,
        // asumimos que es basura.
        const vocales = (s.match(/[aeiouáéíóúüàèìòù]/gi) || []).length;
        const letras = (s.match(/[a-záéíóúüñ]/gi) || []).length;
        if (letras === 0) return true;
        if (vocales === 0 && letras < 6) return true;
        return false;
    };

    // Diagnósticos del Sistema Experto (Enfoque institucional y no técnico)
    const [diagnostico, setDiagnostico] = useState({
        aprobadas: [],
        advertencias: [],
        alertas: [],
    });

    const [loading, setLoading] = useState(false);
    const [exito, setExito] = useState(false);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    // 1. Cargar Catálogos Iniciales (Filtrando estrictamente oficiales de la EPI del usuario)
    useEffect(() => {
        async function cargar() {
            if (!user) return;
            try {
                setCargandoCatalogos(true);
                const paramsEpi = user?.id_epi ? `?id_epi=${user.id_epi}` : '';
                const [t, e, ofs, docs] = await Promise.all([
                    api.get('/tipos-documento'),
                    api.get('/estados-documento'),
                    api.get(`/oficiales${paramsEpi}`), // Solo oficiales de esta EPI
                    api.get(`/documentos${paramsEpi}`),
                ]);
                setTipos(Array.isArray(t) ? t : []);
                setEstados(Array.isArray(e) ? e : []);
                setOficiales(Array.isArray(ofs) ? ofs : []);
                setDocumentosExistentes(Array.isArray(docs) ? docs : []);
            } catch (err) {
                console.error('Error cargando catálogos:', err);
            } finally {
                setCargandoCatalogos(false);
            }
        }
        cargar();
    }, [user]);

    // 2. Autogeneración Inteligente del Código de Documento
    useEffect(() => {
        if (!form.id_tipo) return;

        const esLibre = form.id_tipo === 'otro-libre';
        const tipoObj = !esLibre ? tipos.find((t) => String(t.id_tipo) === String(form.id_tipo)) : null;
        const nombreTipo = (tipoObj?.nombre || form.tipo_libre || '').toLowerCase();

        // Prefijos institucionales por tipo de memorándum
        let prefijo = 'MEM';
        if (nombreTipo.includes('designa'))             prefijo = 'DESIG';
        else if (nombreTipo.includes('llamada') || nombreTipo.includes('atenci')) prefijo = 'LLAM-AT';
        else if (nombreTipo.includes('arrest'))         prefijo = 'ARREST';
        else if (nombreTipo.includes('cuenta') && nombreTipo.includes('vac')) prefijo = 'CTA-VAC';
        else if (nombreTipo.includes('vac'))            prefijo = 'VAC';
        else if (nombreTipo.includes('comisi'))         prefijo = 'COM-EST';
        else if (nombreTipo.includes('cambio') || nombreTipo.includes('destino')) prefijo = 'CAMB-DEST';
        else if (nombreTipo.includes('felicit'))        prefijo = 'MEM-FEL';
        else if (nombreTipo.includes('disciplin'))      prefijo = 'MEM-DISC';
        else if (nombreTipo.includes('permiso'))        prefijo = 'PERM';
        else if (nombreTipo.includes('otro') || esLibre) prefijo = 'OTR';

        const anio = new Date().getFullYear();
        const epiCodigo = user?.id_epi ? `EPI${user.id_epi}` : 'EPI1';

        // Calcular correlativo: se toma el MÁXIMO existente de la EPI + 1
        // (contar documentos falla si alguno fue eliminado y generaría códigos
        // duplicados, que la BD rechaza por la restricción UNIQUE).
        const correlativos = documentosExistentes
            .filter((d) => Number(d.id_epi) === Number(user?.id_epi))
            .map((d) => {
                const m = String(d.codigo_documento || '').match(/-(\d{1,})$/);
                return m ? parseInt(m[1], 10) : 0;
            })
            .filter((n) => !Number.isNaN(n));
        const correlativo = String((correlativos.length ? Math.max(...correlativos) : 0) + 1).padStart(3, '0');

        const codigoGenerado = `${prefijo}-${epiCodigo}-${anio}-${correlativo}`;

        setForm((prev) => ({
            ...prev,
            codigo_documento: codigoGenerado,
        }));
    }, [form.id_tipo, form.tipo_libre, user, documentosExistentes, tipos]);

    // 3. Procesar y Previsualizar Archivo PDF
    const procesarArchivoPdf = async (file) => {
        if (!file) return;

        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            setError('Solo se permiten documentos en formato PDF oficial.');
            return;
        }

        if (file.size > 15 * 1024 * 1024) {
            setError('El archivo PDF supera el tamaño máximo institucional permitido (15 MB).');
            return;
        }

        setError(null);
        setAnalizandoPdf(true);
        setArchivo(file);

        // Crear URL temporal para el visor lateral en vivo
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        const urlTemporal = URL.createObjectURL(file);
        setPdfUrl(urlTemporal);

        try {
            // A) Hash en segundo plano para la base de datos (oculto a los usuarios)
            const buffer = await file.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
            setHashSilencioso(hashHex);

            // B) Extracción básica de texto para análisis del Sistema Experto
            const reader = new FileReader();
            reader.onload = () => {
                const rawContent = reader.result || '';
                const textoPlano = typeof rawContent === 'string' ? rawContent.toLowerCase() : '';
                setPdfTexto(textoPlano);
                setAnalizandoPdf(false);
            };
            reader.readAsText(file.slice(0, 150000));
        } catch (err) {
            console.error('Error analizando PDF:', err);
            setAnalizandoPdf(false);
        }
    };

    // 4. REVISIÓN AUTOMÁTICA EN VIVO: el sistema inspecciona el PDF adjunto.
    //    Se dispara al adjuntar archivo y al cambiar el tipo o el oficial.
    const ejecutarRevisionIA = async (reintento = 0) => {
        if (!archivo) return;
        if (revisionEnCursoRef.current) {
            // Ya hay una revisión en curso (p. ej. el usuario cambió el tipo
            // mientras revisaba): reintentar cuando termine en vez de perder
            // el cambio y dejar un resultado desactualizado.
            if (reintento < 3) {
                setTimeout(() => void ejecutarRevisionIA(reintento + 1), 2000);
            }
            return;
        }
        revisionEnCursoRef.current = true;
        setRevisandoIA(true);
        try {
            const tipoObj = tipos.find((t) => String(t.id_tipo) === String(form.id_tipo));
            const nombreTipo = form.id_tipo === 'otro-libre'
                ? (form.tipo_libre || '')
                : (tipoObj?.nombre || '');
            const oficialNombre = oficialSeleccionado
                ? `${oficialSeleccionado.nombres} ${oficialSeleccionado.apellidos}`
                : '';

            const fd = new FormData();
            fd.append('archivo', archivo);
            fd.append('tipo_esperado', nombreTipo);
            fd.append('oficial_esperado', oficialNombre);

            const rev = await api.upload('/documentos/revisar-ia', fd);
            setRevisionIA(rev);
        } catch (err) {
            // La revisión automática no pudo completarse: se mantiene la verificación básica.
            setRevisionIA({
                ia_disponible: false,
                mensaje: err.message || 'No se pudo completar la revisión automática.',
            });
        } finally {
            revisionEnCursoRef.current = false;
            setRevisandoIA(false);
        }
    };

    // La revisión IA se dispara con debounce (700 ms) desde el efecto de cambios
    // del formulario; la ejecución real vive en ejecutarRevisionIA (llamada también
    // por el botón Reintentar).
    useEffect(() => {
        if (!archivo) return undefined;
        const t = setTimeout(() => {
            void ejecutarRevisionIA();
        }, 700);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [archivo, form.id_tipo, form.tipo_libre, oficialSeleccionado]);

    // 5. Sistema Experto — Revisión Preventiva Institucional
    useEffect(() => {
        const aprobadas = [];
        const advertencias = [];
        const alertas = [];

        // Regla 1: Oficial
        if (oficialSeleccionado) {
            aprobadas.push(`Oficial de dotación verificado: ${oficialSeleccionado.grado?.nombre || 'Of.'} ${oficialSeleccionado.nombres} ${oficialSeleccionado.apellidos}`);
        } else {
            alertas.push(`Falta seleccionar al oficial de la ${user?.epi || 'EPI'}.`);
        }

        // Regla 2: Tipo y Código
        if (form.id_tipo && form.codigo_documento) {
            aprobadas.push(`Código institucional correlativo asignado: ${form.codigo_documento}`);
        } else {
            if (!form.id_tipo) alertas.push('Seleccione el tipo de trámite policial.');
            if (!form.codigo_documento) advertencias.push('Ingrese el número o código correlativo.');
        }

        // Regla 3: Referencia
        if (form.referencia && form.referencia.trim().length >= 5) {
            aprobadas.push('Referencia del documento completada.');
        } else {
            advertencias.push('La referencia del trámite está vacía o muy corta.');
        }

        // Regla 4: Archivo PDF
        if (archivo) {
            aprobadas.push(`Documento PDF cargado correctamente: ${archivo.name} (${(archivo.size / 1024).toFixed(1)} KB)`);

            if (archivo.size < 3000) {
                advertencias.push('El archivo PDF parece demasiado pequeño (< 3 KB), verifique que contenga el documento escaneado.');
            }

            if (pdfTexto) {
                // readAsText lee el binario del PDF: en documentos escaneados
                // (sin capa de texto) produce basura ilegible, y comparar contra
                // ella generaba advertencias falsas. Solo comparamos cuando el
                // PDF tiene texto real; el contenido de un escaneo lo evalúa la
                // IA de visión (revisar-ia).
                const palabrasLegibles = pdfTexto.match(/[a-záéíóúñü]{4,}/g) || [];
                const tieneCapaTexto = palabrasLegibles.length >= 20;

                if (tieneCapaTexto) {
                    const sinTildes = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const textoNorm = sinTildes(pdfTexto);
                    const nombreOficial = sinTildes(oficialSeleccionado?.apellidos?.toLowerCase() || '');
                    const ciOficial = oficialSeleccionado?.ci?.toLowerCase() || '';
                    const tieneMembrete = textoNorm.includes('policia') || textoNorm.includes('comando') || textoNorm.includes('boliv') || textoNorm.includes('epi') || textoNorm.includes('memo');

                    if (!tieneMembrete) {
                        advertencias.push('Aviso: No se detectaron membretes o encabezados institucionales de la Policía Boliviana en el documento.');
                    }

                    if (oficialSeleccionado && nombreOficial.length > 2) {
                        const coincide = textoNorm.includes(nombreOficial) || (ciOficial && textoNorm.includes(ciOficial));
                        if (!coincide) {
                            advertencias.push(`Aviso: El texto del PDF no parece mencionar el apellido (${oficialSeleccionado.apellidos}) ni el C.I. del oficial.`);
                        } else {
                            aprobadas.push(`Coincidencia confirmada con los datos del oficial (${oficialSeleccionado.apellidos}).`);
                        }
                    }
                } else {
                    aprobadas.push('El PDF es un documento escaneado (sin capa de texto); la verificación de contenido la realiza la IA de visión.');
                }
            }
        } else {
            alertas.push('Adjunte el archivo PDF digitalizado del documento físico.');
        }

        // Revisión automática del PDF (servicio de verificación del sistema)
        if (revisionIA) {
            if (revisionIA.ia_disponible === false) {
                advertencias.push(
                    `La verificación automática no está disponible: ${revisionIA.mensaje || 'no se pudo conectar con el servicio de revisión'}. Se aplicó la verificación básica.`
                );
            } else {
                (revisionIA.alertas || []).forEach((a) => alertas.push(a));
                (revisionIA.advertencias || []).forEach((a) => advertencias.push(a));
                if (revisionIA.es_memo && !revisionIA.tipo_detectado) {
                    aprobadas.push('El sistema confirmó que el documento es un memorándum institucional.');
                }
            }
        }

        setDiagnostico({ aprobadas, advertencias, alertas });
    }, [form, oficialSeleccionado, archivo, pdfTexto, user, revisionIA]);

    // Filtrar Oficiales de esta EPI
    const oficialesFiltrados = oficiales.filter((o) => {
        const q = busquedaOficial.toLowerCase();
        const nombres = `${o.nombres || ''} ${o.apellidos || ''}`.toLowerCase();
        const ci = o.ci?.toLowerCase() || '';
        const escalafon = o.escalafon?.toLowerCase() || '';
        const grado = o.grado?.nombre?.toLowerCase() || '';
        const cargo = o.cargo?.nombre?.toLowerCase() || '';
        return nombres.includes(q) || ci.includes(q) || escalafon.includes(q) || grado.includes(q) || cargo.includes(q);
    });

    const handleSelectOficial = (oficial) => {
        setOficialSeleccionado(oficial);
        setMostrarListaOficiales(false);
        setBusquedaOficial('');
        if (error) setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!oficialSeleccionado) {
            setError('Debe seleccionar al oficial involucrado en la unidad.');
            return;
        }
        if (!form.id_tipo) {
            setError('Seleccione el tipo de documento.');
            return;
        }

        // --- Validaciones de integridad del tipo ---

        // Caso libre: el campo "Describir tipo" es obligatorio y no puede ser
        // basura (caracteres aleatorios sin formar texto real).
        if (form.id_tipo === 'otro-libre') {
            if (!form.tipo_libre.trim()) {
                setError('Especifique el tipo de memorándum en el campo "Describir tipo".');
                return;
            }
            if (textoEsBasura(form.tipo_libre)) {
                setError('El tipo ingresado no parece ser válido. Escriba un nombre coherente (ej. Memorándum de Reconocimiento Especial…).');
                return;
            }
        }
        // Nota: la coherencia tipo↔contenido la decide ahora la IA local en
        // vivo (es_memo + tipo detectado), porque leer el texto crudo del PDF
        // binario no es confiable (los escaneos no tienen capa de texto y el
        // bloqueo por palabras clave rechazaba memorándums válidos).

        if (!form.codigo_documento.trim()) {
            setError('El código de memorándum es obligatorio.');
            return;
        }
        if (!form.referencia.trim()) {
            setError('La referencia del documento es obligatoria.');
            return;
        }
        if (!archivo) {
            setError('Debe adjuntar el archivo PDF del documento.');
            return;
        }

        // La fecha oficial del documento DEBE ser HOY (ni ayer ni mañana).
        if (form.fecha_subida !== hoyLocal()) {
            setError('La fecha oficial del documento debe ser la de HOY. No se permiten fechas pasadas ni futuras.');
            return;
        }

        // No abrir el modal mientras el documento todavía se está revisando.
        if (revisandoIA) {
            setError('El documento todavía se está revisando. Espere unos segundos y vuelva a intentarlo.');
            return;
        }

        // Todo válido: pedir confirmación antes de enviar (modal con checklist).
        // La casilla de responsabilidad empieza siempre sin marcar.
        setAceptoResponsabilidad(false);
        setConfirmarEnvio(true);
    };

    /** Envío definitivo: solo se ejecuta tras confirmar el modal. */
    const enviarDefinitivo = async () => {
        setError(null);
        setConfirmarEnvio(false);
        setLoading(true);
        try {
            const hash = hashSilencioso || 'SHA256-' + Date.now();
            const estadoInicial = 2; // Enviado por EPI

            // 0. Subir el PDF físicamente al servidor y usar la ruta persistida
            let rutaPdf = `documentos/${archivo.name}`;
            try {
                const formData = new FormData();
                formData.append('archivo', archivo);
                const up = await api.upload('/upload-documento', formData);
                if (up?.ruta) rutaPdf = up.ruta;
            } catch (upErr) {
                setError(upErr.message || 'No se pudo guardar el archivo PDF en el servidor. Verifique el formato e intente nuevamente.');
                setLoading(false);
                return;
            }

            // Si es tipo libre (Otros), usamos el id del tipo 'Otro' de la BD
            const idTipoFinal = form.id_tipo === 'otro-libre'
                ? (tipos.find(t => t.nombre?.toLowerCase().includes('otro'))?.id_tipo || 6)
                : parseInt(form.id_tipo);

            const payloadDoc = {
                id_tipo: idTipoFinal,
                id_oficial: oficialSeleccionado.id_oficial,
                id_usuario: user.id_usuario,
                id_epi: user.id_epi || 1,
                codigo_documento: form.codigo_documento.trim(),
                referencia: form.referencia.trim(),
                ruta_pdf: rutaPdf,
                hash: hash,
                fecha_subida: form.fecha_subida || new Date().toISOString(),
                estado_actual: estadoInicial,
            };

            const docCreado = await api.post('/documentos', payloadDoc);

            try {
                await api.post('/versiones-documento', {
                    id_documento: docCreado.id_documento,
                    version: 1,
                    ruta_pdf: rutaPdf,
                    subido_por: user.id_usuario,
                });
            } catch (_) {}

            try {
                await api.post('/auditorias', {
                    id_usuario: user.id_usuario,
                    tabla: 'documentos',
                    accion: 'SUBIDA_DOCUMENTO',
                    descripcion: `Emisión y registro del trámite ${form.codigo_documento} para el oficial ${oficialSeleccionado.nombres} ${oficialSeleccionado.apellidos}.`,
                });
            } catch (_) {}

            setExito(true);
            // MODO EN VIVO: aviso inmediato a las otras ventanas abiertas
            // (Comando Departamental/General lo ven sin recargar).
            try {
                await api.get('/sync/ping'); // garantiza que el backend responda antes del broadcast
                window.dispatchEvent(new CustomEvent('ofbol:sync', {
                    detail: { local: true, documento: form.codigo_documento },
                }));
            } catch (_) {}
            mostrarToastGlobal({
                tipo: 'success',
                titulo: 'Documento publicado',
                detalle: `${form.codigo_documento} ya está visible para el Comando (en vivo).`,
            });
            setTimeout(() => {
                navigate('/secretario/mis-documentos');
            }, 2000);
        } catch (err) {
            console.error(err);
            const msgs = err.errors ? Object.values(err.errors).flat().join('. ') : err.message;
            setError(msgs || 'Error al registrar el documento en el sistema.');
        } finally {
            setLoading(false);
        }
    };

    // Checklist del modal de confirmación previa al envío
    const nombreTipoConfirm = form.id_tipo === 'otro-libre'
        ? (form.tipo_libre || 'Otros')
        : (tipos.find((t) => String(t.id_tipo) === String(form.id_tipo))?.nombre || 'Sin tipo');

    // La revisión automática compara contra el tipo que estaba seleccionado
    // cuando se ejecutó; si el tipo cambió después (p. ej. mientras la revisión
    // seguía en curso y no se relanzó), su resultado está desactualizado y no
    // debe contar como válido.
    const revisionDesactualizada = (() => {
        if (!revisionIA || revisionIA.ia_disponible === false) return false;
        const esperado = (revisionIA.tipo_esperado || '').trim().toLowerCase();
        const actual = (nombreTipoConfirm || '').trim().toLowerCase();
        return esperado !== '' && actual !== '' && esperado !== actual;
    })();

    // El resultado de la revisión IA informa al modal. Cuando detecta
    // problemas, el envío NO se bloquea: el modal exige marcar una casilla
    // de asunción de responsabilidad para enviar igualmente. `nivel: 'aviso'
    //` marca las observaciones que el secretario puede superar conscientemente.
    const itemRevisionIA = revisandoIA
        ? { ok: false, texto: 'El documento se está revisando…' }
        : !revisionIA
            ? { ok: true, texto: 'Sin revisión automática en este momento' }
            : revisionIA.ia_disponible === false
                ? { ok: true, texto: `Verificación automática no disponible (${revisionIA.mensaje || 'servicio no disponible'}) — se aplicó la verificación básica` }
                : revisionDesactualizada
                    ? { ok: false, nivel: 'aviso', texto: 'El tipo de memorándum cambió después de la última revisión. Espere la nueva verificación del documento.' }
                    : revisionIA.es_memo === false
                        ? { ok: false, nivel: 'aviso', texto: 'El sistema determinó que el archivo NO es un memorándum institucional' }
                        : revisionIA.coincide_tipo === false
                            ? { ok: false, nivel: 'aviso', texto: `El sistema detectó el tipo "${revisionIA.tipo_detectado || 'desconocido'}", que NO coincide con el seleccionado ("${nombreTipoConfirm}")` }
                            : (revisionIA.alertas || []).length > 0
                                ? { ok: false, nivel: 'aviso', texto: 'El sistema detectó observaciones en el documento. Revise las alertas de la verificación.' }
                                : { ok: true, texto: `El sistema confirmó que el archivo es un memorándum${revisionIA.tipo_detectado ? ` (${revisionIA.tipo_detectado})` : ''}` };
    // El checkout separa dos cosas que antes iban mezcladas en una sola lista de
    // frases: el DATO que se va a remitir (ficha) y la VERIFICACIÓN que hizo el
    // sistema (control). Mezcladas, siete filas de prosa obligaban a leerlas
    // todas para descubrir qué faltaba. `requisitosCompletos` sigue leyendo la
    // lista completa, así que el comportamiento del envío no cambia.
    const checklistConfirmacion = [
        {
            categoria: 'dato',
            etiqueta: 'Oficial',
            ok: !!oficialSeleccionado,
            valor: oficialSeleccionado
                ? `${oficialSeleccionado.grado?.abreviatura || ''} ${oficialSeleccionado.nombres} ${oficialSeleccionado.apellidos}`.trim()
                : null,
            texto: oficialSeleccionado
                ? 'Oficial de la unidad seleccionado'
                : 'Falta seleccionar al oficial de la unidad',
        },
        {
            categoria: 'dato',
            etiqueta: 'Tipo',
            ok: !!form.id_tipo,
            valor: form.id_tipo ? nombreTipoConfirm : null,
            texto: form.id_tipo ? 'Tipo de memorándum seleccionado' : 'Falta seleccionar el tipo de memorándum',
        },
        {
            categoria: 'dato',
            etiqueta: 'Código',
            ok: !!form.codigo_documento.trim(),
            valor: form.codigo_documento.trim() || null,
            texto: form.codigo_documento.trim() ? 'Código de memorándum asignado' : 'Falta el código de memorándum',
        },
        {
            categoria: 'dato',
            etiqueta: 'Fecha',
            ok: form.fecha_subida === hoyLocal(),
            valor: form.fecha_subida,
            texto: form.fecha_subida === hoyLocal()
                ? 'La fecha oficial es la de hoy'
                : 'La fecha oficial debe ser la de HOY (no ayer ni mañana)',
        },
        {
            categoria: 'dato',
            etiqueta: 'Archivo',
            ok: !!archivo,
            valor: archivo ? archivo.name : null,
            texto: archivo ? 'PDF adjunto' : 'Falta adjuntar el archivo PDF',
        },
        {
            categoria: 'verificacion',
            ok: form.referencia.trim().length >= 5,
            texto: form.referencia.trim().length >= 5
                ? 'Referencia institucional completada'
                : 'La referencia es obligatoria (mínimo 5 caracteres)',
        },
        { ...itemRevisionIA, categoria: 'verificacion' },
    ];
    const requisitosCompletos = checklistConfirmacion.every((c) => c.ok);

    // Fichas del trámite: solo los datos que ya están cargados.
    const datosConfirmacion = checklistConfirmacion
        .filter((c) => c.categoria === 'dato' && c.ok && c.valor)
        .map((c) => ({ etiqueta: c.etiqueta, valor: c.valor }));

    // Controles del sistema: lo que falta se muestra, lo que pasa no compite.
    const verificaciones = checklistConfirmacion.filter((c) => c.categoria === 'verificacion');
    const verificacionesFalla = verificaciones.filter((c) => !c.ok);
    const verificacionesOk = verificaciones.filter((c) => c.ok);

    // El panel del sistema experto ordena igual: lo que falta resolver primero.
    const hayObservaciones = diagnostico.alertas.length + diagnostico.advertencias.length > 0;

    if (exito) {
        return (
            <LayoutSecretario>
                <div className="flex items-center justify-center min-h-[65vh] p-6 ofbol-page-enter">
                    <div className="ofbol-card p-8 max-w-md w-full text-center">
                        <span
                            className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto"
                            style={{ background: 'var(--ofbol-teal-wash)', color: 'var(--ofbol-teal)' }}
                            aria-hidden="true"
                        >
                            <Check size={22} strokeWidth={2.6} />
                        </span>
                        <h2 className="ofbol-titulo-seccion mt-4">Documento registrado</h2>
                        <p className="ofbol-nota mx-auto mt-2">
                            El memorándum{' '}
                            <span className="font-mono font-bold" style={{ color: 'var(--ofbol-ink)' }}>
                                {form.codigo_documento}
                            </span>{' '}
                            fue incorporado al flujo documental y remitido al Comando Departamental de La Paz.
                        </p>
                        <p className="ofbol-etiqueta mt-5" style={{ color: 'var(--ofbol-teal)' }}>
                            Redirigiendo a Mis Documentos…
                        </p>
                    </div>
                </div>
            </LayoutSecretario>
        );
    }

    return (
        <LayoutSecretario>
            <div className="p-6 max-w-7xl mx-auto space-y-6">
                {/* Header premium */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <h1 className="ofbol-display heading-balance">Subir y registrar documento</h1>
                        <p className="ofbol-nota mt-2">
                            Registro oficial · {user?.epi || 'EPI Policial'}
                            <span className="text-[#cfc9bc]"> · </span>
                            Digitalizá el memorándum, asigná el oficial y verificá el PDF con la IA local.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 pb-0.5">
                        <span className="ofbol-chip">EPI {user?.id_epi ? `#${user.id_epi}` : ''}</span>
                        <span className="ofbol-chip" style={{ color: '#1a5c52', background: 'rgba(26,92,82,0.08)', borderColor: 'rgba(26,92,82,0.2)' }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#1a5c52', animation: 'epi-parpadeo 1.6s ease-in-out infinite' }} />
                            En vivo
                        </span>
                    </div>
                </div>
                <div className="ofbol-divider" />

                {error && (
                    <Alert type="error" onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* ————————————————————————————————————————————————
                        COLUMNA IZQUIERDA: FORMULARIO Y SELECCIÓN (7 Cols)
                    ———————————————————————————————————————————————— */}
                    <div className="lg:col-span-7 space-y-6">
                        {/* 0. REMITENTE — quién envía el trámite (no editable) */}
                        <Bloque
                            paso={0}
                            titulo="Remitente / Secretario de Unidad"
                            meta={<span className="ofbol-etiqueta">No editable</span>}
                        >
                            <div className="bg-slate-50/80 border border-slate-200 rounded-[14px] p-4 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3.5 min-w-0">
                                    <div className="w-11 h-11 rounded-xl bg-slate-800 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                                        {(user?.usuario || 'S')?.[0]?.toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-slate-900 truncate">
                                            {user?.usuario || 'Secretario'} · {user?.rol || 'Secretario EPI'}
                                        </p>
                                        <p className="text-xs text-slate-500 truncate mt-0.5">
                                            {user?.epi || 'EPI asignada'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Bloque>

                        {/* 1. SELECCIÓN DE OFICIAL DE ESTA EPI */}
                        <Bloque
                            paso={1}
                            titulo={`Oficial de la ${user?.epi || 'EPI'}`}
                            meta={<span className="ofbol-etiqueta">{oficiales.length} efectivos</span>}
                        >

                            {/* Tarjeta de Oficial Seleccionado */}
                            {oficialSeleccionado ? (
                                <div className="rounded-[14px] p-4 flex items-center justify-between gap-4" style={{ background: 'var(--ofbol-olive-wash)', border: '1px solid rgba(61, 74, 44, 0.25)' }}>
                                    <div className="flex items-center gap-3.5 min-w-0">
                                    <AvatarFoto
                                        foto={oficialSeleccionado.foto}
                                        nombre={`${oficialSeleccionado.nombres} ${oficialSeleccionado.apellidos}`}
                                        iniciales={`${oficialSeleccionado.nombres?.[0] || ''}${oficialSeleccionado.apellidos?.[0] || ''}`}
                                        className="w-11 h-11 rounded-xl text-sm"
                                        fallbackClassName="bg-emerald-700"
                                    />
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-emerald-950 truncate">
                                                    {oficialSeleccionado.grado?.nombre || 'Oficial'} {oficialSeleccionado.nombres} {oficialSeleccionado.apellidos}
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-900">
                                                    {oficialSeleccionado.grado?.abreviatura || 'Of.'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-emerald-800 font-mono mt-0.5">
                                                C.I.: {oficialSeleccionado.ci} · Esc: {oficialSeleccionado.escalafon || '—'} · {oficialSeleccionado.cargo?.nombre || 'Servicio'}
                                            </p>
                                            {/* Badge de categoría de escalafón inferida del grado */}
                                            {(() => {
                                                const g = oficialSeleccionado.grado?.nombre || '';
                                                const gl = g.toLowerCase();
                                                const esOf = ['coronel','teniente coronel','mayor','capitán','teniente','subteniente'].some(x => gl.includes(x));
                                                const esAdm = gl.includes('admin') || gl.includes('plantel');
                                                if (esOf) return <span className="ofbol-badge ofbol-badge--teal mt-1">OF · Oficial</span>;
                                                if (esAdm) return <span className="ofbol-badge ofbol-badge--amber mt-1">ADM · Plantel Administrativo</span>;
                                                return <span className="ofbol-badge ofbol-badge--olive mt-1">PP · Policía Profesional (ant. BF / CB)</span>;
                                            })()}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setOficialSeleccionado(null);
                                            setMostrarListaOficiales(true);
                                        }}
                                        className="ofbol-btn-ghost shrink-0"
                                    >
                                        Cambiar
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {/* Barra de Búsqueda */}
                                    <div className="relative">
                                        <svg className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        <input
                                            type="text"
                                            placeholder={`Buscar oficial de ${user?.epi || 'esta EPI'} por C.I., Escalafón, Nombre o Grado...`}
                                            value={busquedaOficial}
                                            onChange={(e) => {
                                                setBusquedaOficial(e.target.value);
                                                setMostrarListaOficiales(true);
                                            }}
                                            onFocus={() => setMostrarListaOficiales(true)}
                                            className="ofbol-input w-full pl-10 pr-4"
                                        />
                                    </div>

                                    {/* Listado de Oficiales de la EPI */}
                                    <div className="border border-slate-200 rounded-xl max-h-56 overflow-y-auto divide-y divide-slate-100 bg-white">
                                        {cargandoCatalogos ? (
                                            <div className="p-4 text-center text-xs text-slate-400 flex justify-center items-center gap-2">
                                                <Spinner size="sm" /> Cargando lista de oficiales de la unidad...
                                            </div>
                                        ) : oficialesFiltrados.length === 0 ? (
                                            <EstadoVacio
                                                compacto
                                                icono={Users}
                                                titulo="Sin coincidencias"
                                                nota={`Ningún oficial de ${user?.epi || 'esta EPI'} coincide con «${busquedaOficial}».`}
                                            />
                                        ) : (
                                            oficialesFiltrados.map((of) => (
                                                <button
                                                    key={of.id_oficial}
                                                    type="button"
                                                    onClick={() => handleSelectOficial(of)}
                                                    className="w-full p-2.5 text-left hover:bg-emerald-50/80 transition-colors flex items-center justify-between group"
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-8 h-8 rounded-lg bg-emerald-50 group-hover:bg-emerald-200 text-emerald-800 font-bold text-xs flex items-center justify-center border border-emerald-200">
                                                            {of.grado?.abreviatura || 'OF'}
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-950">
                                                                {of.grado?.nombre} {of.nombres} {of.apellidos}
                                                            </p>
                                                            <p className="text-[10px] text-slate-500 font-mono">
                                                                CI: {of.ci} · Esc: {of.escalafon || '—'} · Cargo: {of.cargo?.nombre || 'Servicio'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <span className="text-[11px] font-bold text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        Seleccionar →
                                                    </span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </Bloque>

                        {/* 2. DATOS DEL DOCUMENTO */}
                        <Bloque paso={2} titulo="Datos del Trámite Policial">

                            <div className="space-y-3.5 text-xs">
                                <div>
                                    <label htmlFor="tipo-memo" className="block font-semibold text-slate-700 mb-1">
                                        Tipo de Memorándum <span className="text-red-500" aria-hidden="true">*</span>
                                    </label>

                                    {/* Tipos comunes como botones rápidos de selección */}
                                    <div className="grid grid-cols-2 gap-1.5 mb-2">
                                        {(() => {
                                            const comunes = tipos.filter(t =>
                                                TIPOS_COMUNES_NOMBRES.some(n =>
                                                    t.nombre?.toLowerCase() === n.toLowerCase()
                                                )
                                            );
                                            // Ordenar según TIPOS_COMUNES_NOMBRES
                                            comunes.toSorted((a, b) => {
                                                const ia = TIPOS_COMUNES_NOMBRES.findIndex(n => n.toLowerCase() === a.nombre?.toLowerCase());
                                                const ib = TIPOS_COMUNES_NOMBRES.findIndex(n => n.toLowerCase() === b.nombre?.toLowerCase());
                                                return ia - ib;
                                            });
                                            return comunes.map(t => (
                                                <button
                                                    key={t.id_tipo}
                                                    type="button"
                                                    onClick={() => setForm({ ...form, id_tipo: String(t.id_tipo), tipo_libre: '' })}
                                                    className={`px-2.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide border transition-colors text-left leading-tight ${
                                                        String(form.id_tipo) === String(t.id_tipo)
                                                            ? 'bg-[#3d4a2c] text-[#fbfaf6] border-[#2f3a21]'
                                                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-[#f2f4ec] hover:border-[#8a9a6d] hover:text-[#3d4a2c]'
                                                    }`}
                                                >
                                                    {t.nombre}
                                                </button>
                                            ));
                                        })()}

                                        {/* Botón Otros */}
                                        <button
                                            type="button"
                                            onClick={() => setForm({ ...form, id_tipo: 'otro-libre', tipo_libre: '' })}
                                            className={`px-2.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide border transition-colors text-left leading-tight col-span-2 ${
                                                form.id_tipo === 'otro-libre'
                                                    ? 'bg-[#495456] text-[#fbfaf6] border-[#3c4547]'
                                                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:border-slate-400'
                                            }`}
                                        >
                                            Otros (especificar tipo)
                                        </button>
                                    </div>

                                    {/* Campo libre si seleccionó Otros */}
                                    {form.id_tipo === 'otro-libre' && (
                                        <div className="mt-2">
                                            <label htmlFor="tipo-libre" className="block font-semibold text-slate-700 mb-1">
                                                Describir tipo de memorándum <span className="text-red-500" aria-hidden="true">*</span>
                                            </label>
                                            <input aria-label="Ej: Memorándum de Reconocimiento Especial…"
                                                type="text"
                                                id="tipo-libre"
                                                autoFocus
                                                placeholder="Ej: Memorándum de Reconocimiento Especial…"
                                                value={form.tipo_libre}
                                                onChange={(e) => setForm({ ...form, tipo_libre: e.target.value })}
                                                className="ofbol-input w-full"
                                            />
                                            <p className="text-[10px] text-slate-400 mt-1">Este tipo no está en los comunes. El administrador puede añadirlo al catálogo oficial desde su panel.</p>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label htmlFor="codigo-memo" className="font-semibold text-slate-700">
                                                N.° de Memorándum / Código <span className="text-red-500">*</span>
                                            </label>
                                            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                                                Autogenerado
                                            </span>
                                        </div>
                                        <input aria-label="Ej: MEM-DISC-EPI1-2026-001"
                                            type="text"
                                            id="codigo-memo"
                                            required
                                            value={form.codigo_documento}
                                            onChange={(e) => setForm({ ...form, codigo_documento: e.target.value })}
                                            placeholder="Ej: MEM-DISC-EPI1-2026-001"
                                            className="ofbol-input w-full font-mono font-bold tabular-nums"
                                        />
                                    </div>

                                    <div>
                                    <label htmlFor="fecha-doc" className="block font-semibold text-slate-700 mb-1">
                                        Fecha Oficial del Documento <span className="text-red-500" aria-hidden="true">*</span>
                                    </label>
                                        <input
                                            type="date"
                                            id="fecha-doc"
                                            required
                                            value={form.fecha_subida}
                                            min={hoyLocal()}
                                            max={hoyLocal()}
                                            onChange={(e) => setForm({ ...form, fecha_subida: e.target.value })}
                                            className="ofbol-input w-full"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">Solo se permite la fecha de hoy (no fechas pasadas ni futuras).</p>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="referencia" className="block font-semibold text-slate-700 mb-1">
                                        Referencia Institucional <span className="text-red-500" aria-hidden="true">*</span>
                                    </label>
                                    <input aria-label="Ej: Ref. Notificación de Memorándum de Felicitación por Servicio Distinguido"
                                        type="text"
                                        id="referencia"
                                        required
                                        placeholder="Ej: Ref. Notificación de Memorándum de Felicitación por Servicio Distinguido"
                                        value={form.referencia}
                                        onChange={(e) => setForm({ ...form, referencia: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus-visible:ring-2 focus-visible:ring-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="notas" className="block font-semibold text-slate-700 mb-1">
                                        Observaciones / Notas del Secretario (Opcional)
                                    </label>
                                    <textarea aria-label="Notas adicionales registradas por el secretario de unidad…"
                                        id="notas"
                                        rows={2}
                                        placeholder="Notas adicionales registradas por el secretario de unidad…"
                                        value={form.descripcion}
                                        onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                                        className="ofbol-input w-full resize-none"
                                    />
                                </div>
                            </div>
                        </Bloque>

                        {/* 3. ADJUNTAR ARCHIVO PDF */}
                        <Bloque paso={3} titulo="Archivo PDF Digitalizado">

                            {!archivo ? (
                                <div
                                    role="button"
                                    tabIndex={0}
                                    aria-label="Zona para arrastrar el PDF"
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        procesarArchivoPdf(e.dataTransfer.files[0]);
                                    }}
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-slate-300 hover:border-[#8a9a6d] bg-slate-50 hover:bg-[#f2f4ec] rounded-[14px] p-6 text-center cursor-pointer transition-colors space-y-2"
                                >
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto" style={{ background: 'var(--ofbol-olive-wash)', color: 'var(--ofbol-olive)' }}>
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M16 12l-4-4-4 4M12 8v8" />
                                        </svg>
                                    </div>
                                    <p className="text-xs font-bold text-slate-800">
                                        Haga clic o arrastre aquí el documento PDF oficial
                                    </p>
                                    <p className="text-[10px] text-slate-400">
                                        Solo formato PDF · Máximo 15 MB
                                    </p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        id="archivo-pdf"
                                        accept=".pdf"
                                        className="hidden"
                                        aria-label="Seleccionar archivo PDF"
                                        onChange={(e) => procesarArchivoPdf(e.target.files[0])}
                                    />
                                </div>
                            ) : (
                                <div className="p-3.5 rounded-[14px] flex items-center justify-between gap-3" style={{ background: 'var(--ofbol-olive-wash)', border: '1px solid rgba(61, 74, 44, 0.22)' }}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-lg text-white font-bold text-xs flex items-center justify-center shrink-0" style={{ background: 'var(--ofbol-olive)' }}>
                                            PDF
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold truncate" style={{ color: 'var(--ofbol-ink)' }}>{archivo.name}</p>
                                            <p className="ofbol-etiqueta mt-0.5" style={{ color: 'var(--ofbol-olive)' }}>
                                                {(archivo.size / 1024).toFixed(1)} KB · Listo para registro oficial
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setArchivo(null);
                                            setPdfUrl(null);
                                            setPdfTexto('');
                                            setHashSilencioso('');
                                            setRevisionIA(null);
                                            if (fileInputRef.current) fileInputRef.current.value = '';
                                        }}
                                        className="ofbol-btn-ghost shrink-0"
                                    >
                                        Cambiar
                                    </button>
                                </div>
                            )}
                        </Bloque>
                    </div>

                    {/* ————————————————————————————————————————————————
                        COLUMNA DERECHA: PREVISUALIZADOR PDF + SISTEMA EXPERTO (5 Cols)
                    ———————————————————————————————————————————————— */}
                    <div className="lg:col-span-5 space-y-6">
                        {/* PREVISUALIZADOR DE PDF EN VIVO */}
                        <SeccionPanel
                            titulo="Previsualizador de documento"
                            accion={pdfUrl ? (
                                <a
                                    href={pdfUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="ofbol-etiqueta shrink-0 hover:underline"
                                    style={{ color: 'var(--ofbol-olive)' }}
                                >
                                    Abrir en pestaña ↗
                                </a>
                            ) : null}
                        >

                            {pdfUrl ? (
                                <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
                                    <iframe
                                        src={pdfUrl}
                                        title="Vista Previa Documento PDF"
                                        className="w-full h-80 rounded-xl"
                                    />
                                </div>
                            ) : (
                                <EstadoVacio
                                    icono={FileText}
                                    titulo="Sin archivo PDF seleccionado"
                                    nota="Al elegir el archivo, el documento completo aparece acá."
                                />
                            )}
                        </SeccionPanel>

                        {/* REVISIÓN PREVENTIVA DEL SISTEMA EXPERTO */}
                        <div className="ofbol-card p-5 space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div className="flex items-center gap-2">
                                    {/* Indicador del estado de la revisión automática */}
                                    <span
                                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                            revisandoIA
                                                ? 'bg-amber-500'
                                                : revisionIA?.ia_disponible === false
                                                ? 'bg-red-500'
                                                : revisionIA?.ia_disponible === true
                                                ? 'bg-emerald-500'
                                                : 'bg-slate-300'
                                        }`}
                                        title={
                                            revisandoIA
                                                ? 'El documento se está revisando'
                                                : revisionIA?.ia_disponible === false
                                                ? 'La revisión automática no está disponible'
                                                : revisionIA?.ia_disponible === true
                                                ? 'Revisión automática activa'
                                                : 'Esperando documento'
                                        }
                                    />
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                                        Verificación del Documento
                                    </h3>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                        revisandoIA
                                            ? 'bg-amber-100 text-amber-800'
                                            : revisionIA?.ia_disponible === false
                                            ? 'bg-red-100 text-red-700'
                                            : revisionIA?.ia_disponible === true
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {revisandoIA
                                            ? 'Revisando…'
                                            : revisionIA?.ia_disponible === false
                                            ? 'No disponible'
                                            : revisionIA?.ia_disponible === true
                                            ? 'Activa'
                                            : 'En espera'}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                        diagnostico.alertas.length > 0
                                            ? 'bg-red-100 text-red-800'
                                            : diagnostico.advertencias.length > 0
                                            ? 'bg-amber-100 text-amber-900'
                                            : 'bg-emerald-100 text-emerald-900'
                                    }`}>
                                        {diagnostico.alertas.length > 0
                                            ? `${diagnostico.alertas.length} faltante(s)`
                                            : diagnostico.advertencias.length > 0
                                            ? `${diagnostico.advertencias.length} aviso(s)`
                                            : 'Conforme'}
                                    </span>
                                </div>
                            </div>

                            {/* Banner de revisión automática no disponible con botón de reintento */}
                            {revisionIA?.ia_disponible === false && !revisandoIA && (
                                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs flex items-start gap-2">
                                    <AlertTriangle size={14} className="text-red-600 shrink-0" aria-hidden="true" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold">La revisión automática no está disponible</p>
                                        <p className="text-[11px] text-red-800 mt-0.5 leading-snug">
                                            {revisionIA.mensaje || 'No se pudo conectar con el servicio de revisión. Se aplicará la verificación básica.'}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => ejecutarRevisionIA()}
                                        disabled={revisandoIA}
                                        className="shrink-0 px-2.5 py-1.5 text-[10px] font-bold text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Reintentar
                                    </button>
                                </div>
                            )}

                            {analizandoPdf && (
                                <div className="p-2.5 bg-blue-50 text-blue-800 rounded-xl text-xs flex items-center gap-2">
                                    <Spinner size="sm" />
                                    <span>Inspeccionando documento PDF...</span>
                                </div>
                            )}

                            {revisandoIA && (
                                <div className="p-2.5 bg-orange-50 border border-orange-200 text-orange-900 rounded-xl text-xs flex items-center gap-2">
                                    <Spinner size="sm" />
                                    <span>
                                        Revisando el documento: tipo, destinatario, fecha, firma y sello...
                                    </span>
                                </div>
                            )}

                            {revisionIA?.ia_disponible === true && revisionIA?.tiempo_seg != null && (
                                <div className="text-[10px] text-slate-400 text-right">
                                    Revisión completada en {revisionIA.tiempo_seg} s
                                </div>
                            )}

                            <div className="space-y-2 text-xs">
                                {/* Alertas Críticas */}
                                {diagnostico.alertas.map((alerta) => (
                                    <div key={`al-${alerta}`} className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-900 flex items-start gap-2">
                                        <X size={14} className="text-red-600 shrink-0" aria-hidden="true" />
                                        <span>{alerta}</span>
                                    </div>
                                ))}

                                {/* Advertencias de Contenido */}
                                {diagnostico.advertencias.map((adv) => (
                                    <div key={`adv-${adv}`} className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2">
                                        <AlertTriangle size={14} className="text-amber-600 shrink-0" aria-hidden="true" />
                                        <span>{adv}</span>
                                    </div>
                                ))}

                                {/* Validaciones superadas — plegadas cuando hay algo que
                                    resolver, para que no compitan con lo urgente. */}
                                {diagnostico.aprobadas.length > 0 && (
                                    hayObservaciones ? (
                                        <details>
                                            <summary className="cursor-pointer list-none text-[10px] font-bold text-slate-400 hover:text-slate-700">
                                                Ver las {diagnostico.aprobadas.length} validaciones superadas
                                            </summary>
                                            <div className="mt-2 space-y-2">
                                                {diagnostico.aprobadas.map((ap) => (
                                                    <div key={`ap-${ap}`} className="p-2 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-emerald-900 flex items-start gap-2 text-[11px]">
                                                        <Check size={14} className="text-emerald-600 shrink-0" aria-hidden="true" />
                                                        <span>{ap}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </details>
                                    ) : (
                                        diagnostico.aprobadas.map((ap) => (
                                            <div key={`ap-${ap}`} className="p-2 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-emerald-900 flex items-start gap-2 text-[11px]">
                                                <Check size={14} className="text-emerald-600 shrink-0" aria-hidden="true" />
                                                <span>{ap}</span>
                                            </div>
                                        ))
                                    )
                                )}
                            </div>

                            {/* Botón de Envío */}
                            <div className="pt-2 border-t border-slate-100 space-y-2">
                                <button
                                    type="submit"
                                    disabled={loading || revisandoIA}
                                    className="ofbol-btn-primary w-full"
                                >
                                    {loading ? (
                                        <>
                                            <Spinner size="sm" />
                                            Procesando y Registrando...
                                        </>
                                    ) : revisandoIA ? (
                                        <>
                                            <Spinner size="sm" />
                                            Revisando el documento...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M16 12l-4-4-4 4M12 8v8" />
                                            </svg>
                                            Registrar y Remitir al Comando Dptal.
                                        </>
                                    )}
                                </button>
                                <p className="text-[10px] text-slate-400 text-center">
                                    El trámite pasará a la Cola de Revisión del Comando Departamental de La Paz.
                                </p>
                            </div>
                        </div>
                    </div>
                </form>
            </div>

            {/* MODAL: Confirmación previa al envío con checklist de completitud */}
            <Modal
                open={confirmarEnvio}
                onClose={() => setConfirmarEnvio(false)}
                title="¿Seguro que desea enviar el documento?"
                size="lg"
            >
                <div className="space-y-4">
                    <p className="ofbol-nota">
                        Revise el estado del trámite antes de remitirlo al Comando Departamental de La Paz.
                    </p>

                        {/* ── Lo que se remite: fichas de dato, no frases ── */}
                        {datosConfirmacion.length > 0 && (
                            <div className="space-y-2">
                                <p className="ofbol-etiqueta">Trámite a remitir</p>
                                <ChipsDato datos={datosConfirmacion} />
                            </div>
                        )}

                        {/* ── Verificaciones: primero lo que falta ── */}
                        <div className="space-y-2">
                            <div className="flex items-baseline justify-between gap-2">
                                <p className="ofbol-etiqueta">Verificaciones</p>
                                <p className={`text-[10px] font-black tabular-nums ${
                                    verificacionesFalla.length === 0 ? 'text-emerald-700' : 'text-amber-700'
                                }`}>
                                    {verificacionesOk.length} / {verificaciones.length}
                                </p>
                            </div>

                            {verificacionesFalla.length === 0 ? (
                                <p className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-xs font-bold text-emerald-900">
                                    <Check size={13} strokeWidth={2.5} className="shrink-0" aria-hidden="true" />
                                    Todas las verificaciones se superaron.
                                </p>
                            ) : (
                                <ul className="space-y-1.5">
                                    {verificacionesFalla.map((item) => (
                                        <li
                                            key={item.texto}
                                            className={`flex items-start gap-2 p-2.5 rounded-xl border text-xs leading-snug ${
                                                item.nivel === 'aviso'
                                                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                                                    : 'bg-red-50 border-red-200 text-red-900'
                                            }`}
                                        >
                                            {item.nivel === 'aviso'
                                                ? <AlertTriangle size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
                                                : <X size={13} strokeWidth={2.5} className="shrink-0 mt-0.5" aria-hidden="true" />}
                                            <span>{item.texto}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {/* Las que sí pasan quedan disponibles, pero no compiten
                                con lo que falta por resolver. */}
                            {verificacionesOk.length > 0 && verificacionesFalla.length > 0 && (
                                <details>
                                    <summary className="cursor-pointer list-none text-[10px] font-bold text-slate-400 hover:text-slate-700">
                                        Ver las {verificacionesOk.length} verificaciones superadas
                                    </summary>
                                    <ul className="mt-1.5 space-y-1">
                                        {verificacionesOk.map((item) => (
                                            <li key={item.texto} className="flex items-start gap-2 text-[11px] text-slate-500 leading-snug">
                                                <Check size={11} strokeWidth={2.5} className="shrink-0 mt-0.5 text-emerald-600" aria-hidden="true" />
                                                <span>{item.texto}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </details>
                            )}
                        </div>

                        {/* Casilla de responsabilidad: se muestra cuando hay observaciones.
                            El envío no se bloquea, pero exige una confirmación explícita. */}
                        {!requisitosCompletos && (
                            <label
                                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer select-none transition-colors ${
                                    aceptoResponsabilidad
                                        ? 'bg-emerald-50 border-emerald-300'
                                        : 'bg-slate-50 border-slate-300 hover:border-slate-400'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={aceptoResponsabilidad}
                                    onChange={(e) => setAceptoResponsabilidad(e.target.checked)}
                                    className="mt-0.5 w-4 h-4 accent-emerald-700 shrink-0"
                                />
                                <span className="text-xs text-slate-800 leading-snug">
                                    Entiendo las observaciones señaladas y <span className="font-bold">asumo la responsabilidad</span> de enviar el documento tal como está.
                                </span>
                            </label>
                        )}

                    <div className="flex gap-2 pt-1">
                        <button
                            type="button"
                            onClick={() => setConfirmarEnvio(false)}
                            className="ofbol-btn-ghost flex-1 justify-center"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={enviarDefinitivo}
                            disabled={!requisitosCompletos && !aceptoResponsabilidad}
                            className="ofbol-btn-primary flex-1 justify-center"
                            style={!requisitosCompletos ? { background: 'var(--ofbol-amber)', borderColor: '#7f5a07' } : undefined}
                        >
                            {requisitosCompletos ? 'Sí, enviar definitivamente' : 'Enviar de todas formas'}
                        </button>
                    </div>
                </div>
            </Modal>
        </LayoutSecretario>
    );
}
