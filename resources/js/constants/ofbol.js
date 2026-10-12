/**
 * OFBOL — Design Tokens para el módulo Secretario EPI
 * Paleta institucional: oliva oscuro boliviano + neutros cálidos
 *
 * Estas escalas son la fuente de verdad del color institucional. Deben
 * coincidir con el remapeo de paleta de resources/css/app.css: si acá hay
 * un verde de sistema o un gris frío, se cuela en toda la aplicación.
 */
export const COLORS = {
    brand: {
        50: '#f2f4ec',
        100: '#e6ebdb',
        200: '#d3dbc0',
        300: '#b4c094',
        400: '#8a9a6d',
        500: '#6d7d4f',
        600: '#5a6b3d',
        700: '#3d4a2c',
        800: '#33401f',
        900: '#2a351a',
    },
};

/**
 * ESTADOS — Paleta INSTITUCIONAL del flujo documental (rama oliva/ámbar/teal).
 * Se evita la paleta genérica de Tailwind (blue/emerald/purple) para que los
 * badges de estado sean reconocibles y coherentes con la identidad de OFBOL.
 */
export const ESTADOS = {
    Borrador:                     { label: 'Borrador',       color: 'bg-[#f1f0ec] text-[#5a615f] border border-[#e2e0db]', dot: 'bg-[#a8a5a0]' },
    'Enviado por EPI':            { label: 'Enviado',        color: 'bg-[#eef0f2] text-[#495456] border border-[#dde1e5]', dot: 'bg-[#495456]' },
    'En revisión':                { label: 'En revisión',    color: 'bg-[#fdf6e3] text-[#7f5a07] border border-[#f3e2b3]', dot: 'bg-[#9a6f0a]' },
    Observado:                    { label: 'Observado',      color: 'bg-[#faf0e8] text-[#8b4513] border border-[#eddac9]', dot: 'bg-[#8b4513]' },
    Devuelto:                     { label: 'Devuelto',       color: 'bg-[#fbeaea] text-[#8f2020] border border-[#f0cfcf]', dot: 'bg-[#8f2020]' },
    Aprobado:                     { label: 'Aprobado',       color: 'bg-[#e8f3f1] text-[#1a5c52] border border-[#cbe4df]', dot: 'bg-[#1a5c52]' },
    'Remitido al Comando General':{ label: 'Remitido C.G.',  color: 'bg-[#eceee6] text-[#33401f] border border-[#d8ddc9]', dot: 'bg-[#3d4a2c]' },
    Registrado:                   { label: 'Registrado',     color: 'bg-[#eef1e6] text-[#4a5a35] border border-[#dbe2c8]', dot: 'bg-[#6d7d4f]' },
};

/**
 * COLOR_ESTADO — color plano por estado del flujo documental.
 * Fuente única: los gráficos (bandas, comparativas, mapas de calor) y los
 * badges leen de acá, así ningún panel inventa su propio hex.
 */
export const COLOR_ESTADO = {
    Borrador: '#a8a5a0',
    'Enviado por EPI': '#5a615f',
    'En revisión': '#9a6f0a',
    Observado: '#8b4513',
    Devuelto: '#8f2020',
    Aprobado: '#1a5c52',
    'Remitido al Comando General': '#3d4a2c',
    Registrado: '#5a6b3d',
};

/** Tono semántico de un estado, para la línea de tiempo y los nodos. */
export const TONO_ESTADO = {
    Borrador: 'gris',
    'Enviado por EPI': 'gris',
    'En revisión': 'ambar',
    Observado: 'crimson',
    Devuelto: 'crimson',
    Aprobado: 'teal',
    'Remitido al Comando General': 'oliva',
    Registrado: 'oliva',
};

/**
 * ORDEN_ESTADOS — ciclo de vida del trámite.
 * Se usa para ordenar bandas de distribución, leyendas y mapas de calor:
 * un mismo orden en toda la aplicación hace las cifras comparables de un
 * vistazo entre pantallas.
 */
export const ORDEN_ESTADOS = [
    'Borrador',
    'Enviado por EPI',
    'En revisión',
    'Observado',
    'Devuelto',
    'Aprobado',
    'Remitido al Comando General',
    'Registrado',
];

/** Etapas del recorrido institucional (usadas por los diagramas de flujo). */
export const ETAPAS_FLUJO = [
    { clave: 'epi', label: 'Secretaría EPI', sub: 'Emisión' },
    { clave: 'departamental', label: 'Cmd. Departamental', sub: 'Visado' },
    { clave: 'general', label: 'Cmd. General', sub: 'Registro' },
];

export const API_BASE = '/api';

export const TIPOS_DOCUMENTO = [
    { id: 1, nombre: 'Memorándum disciplinario' },
    { id: 2, nombre: 'Memorándum felicitación' },
    { id: 3, nombre: 'Permiso' },
    { id: 4, nombre: 'Vacación' },
    { id: 5, nombre: 'Designación' },
    { id: 6, nombre: 'Otro' },
];
