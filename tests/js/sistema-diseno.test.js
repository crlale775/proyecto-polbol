/**
 * Pruebas de las REGLAS del sistema de diseño.
 *
 * No prueban una vista: prueban que el sistema siga siendo el sistema. Son las
 * reglas por las que pasaron las 28 vistas y que es fácil volver a romper en la
 * próxima tanda. Si alguien reintroduce un `rounded-3xl`, una sombra apilada
 * sobre borde, un título genérico o un `window.confirm`, esto lo dice.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const RAIZ_VISTAS = 'resources/views';
const CSS = 'resources/css/app.css';

function archivos(dir, extension = '.jsx') {
    return readdirSync(dir).flatMap((entrada) => {
        const ruta = join(dir, entrada);
        if (statSync(ruta).isDirectory()) return archivos(ruta, extension);
        return ruta.endsWith(extension) ? [ruta] : [];
    });
}

/** Cada vista con su contenido, para poder señalar el archivo en el error. */
const VISTAS = archivos(RAIZ_VISTAS).map((ruta) => ({ ruta, texto: readFileSync(ruta, 'utf8') }));
const COMPONENTES_JS = archivos('resources/js').map((ruta) => ({ ruta, texto: readFileSync(ruta, 'utf8') }));
const TODO_JS = [...VISTAS, ...COMPONENTES_JS];

/** Cadenas de clases (entre comillas o backticks) de un archivo. */
function cadenasDeClases(texto) {
    return [...texto.matchAll(/(["`])((?:(?!\1)[\s\S])*)\1/g)].map((m) => m[2]);
}

describe('Sistema de diseño · reglas', () => {
    it('no hay radios fuera de la escala (12–16 px)', () => {
        const ofensores = VISTAS
            .filter(({ texto }) => /rounded-(?:2xl|3xl|\[2[0-9]px\]|\[3[0-9]px\])/.test(texto))
            .map(({ ruta }) => ruta);
        expect(ofensores).toEqual([]);
    });

    it('ninguna tarjeta apila sombra sobre borde (regla R10)', () => {
        const ofensores = [];
        for (const { ruta, texto } of VISTAS) {
            for (const clases of cadenasDeClases(texto)) {
                if (/\bborder\b/.test(clases) && /\b(?:hover:)?shadow-(?:sm|md|lg|xl|2xl|2xs|xs)\b/.test(clases)) {
                    ofensores.push(`${ruta} → ${clases.trim().slice(0, 70)}`);
                    break;
                }
            }
        }
        expect(ofensores).toEqual([]);
    });

    it('los títulos de página usan la escala tipográfica del sistema', () => {
        const ofensores = VISTAS
            .filter(({ texto }) =>
                /<h1[^>]*className="text-(?:xl|2xl|\[26px\])\s+font-(?:black|bold)\s+text-slate-900/.test(texto)
            )
            .map(({ ruta }) => ruta);
        expect(ofensores).toEqual([]);
    });

    it('no quedan diálogos nativos del navegador', () => {
        const ofensores = VISTAS
            .filter(({ texto }) => /\bwindow\.confirm\s*\(/.test(texto) || /(^|[^.\w])alert\s*\(/.test(texto))
            .map(({ ruta }) => ruta);
        expect(ofensores).toEqual([]);
    });

    it('todo token --ofbol-* usado existe en app.css', () => {
        const css = readFileSync(CSS, 'utf8');
        const declarados = new Set([...css.matchAll(/(--ofbol-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));

        const usados = new Set();
        for (const archivo of TODO_JS) {
            for (const m of archivo.texto.matchAll(/var\((--ofbol-[a-z0-9-]+)/g)) usados.add(m[1]);
        }

        const inexistentes = [...usados].filter((token) => !declarados.has(token));
        expect(inexistentes).toEqual([]);
    });

    it('toda clase ofbol-* usada existe en app.css (sin clases inventadas)', () => {
        const css = readFileSync(CSS, 'utf8');
        const definidas = new Set([...css.matchAll(/\.(ofbol-[a-z0-9-]+)/g)].map((m) => m[1]));

        // El lookbehind descarta `var(--ofbol-x)`: ahí `ofbol-x` es un token de CSS,
        // no una clase.
        const donde = new Map();
        for (const archivo of TODO_JS) {
            for (const m of archivo.texto.matchAll(/(?<![-\w])(ofbol-[a-z0-9-]+)/g)) {
                if (!donde.has(m[1])) donde.set(m[1], archivo.ruta);
            }
        }

        // Una clase también cuenta si es el prefijo de una definida: cubre las
        // clases armadas por concatenación (`ofbol-badge--${tono}`).
        const existe = (clase) => definidas.has(clase) || [...definidas].some((d) => d.startsWith(clase));

        const inventadas = [...donde.entries()]
            .filter(([clase]) => !existe(clase))
            .map(([clase, ruta]) => `${clase} · ${ruta}`);
        expect(inventadas).toEqual([]);
    });

    it('las vistas de rol usan la entrada de página del sistema', () => {
        /* Exentos:
         *  · login/registro público — no siguen la anatomía de un layout de rol.
         *  · `repertorios/ui/` — son primitivas, la entrada la pone la página que las usa.
         *  · envoltorios puros sin `className` — delegan en un motor compartido
         *    (`ReportesEngine`, `RecorridoInstitucional`) que es quien la aplica. */
        const enDirectorioExento = /(^|\/)(login|publico|auth|repertorios)\//;
        const ofensores = VISTAS
            .filter(({ ruta }) => !enDirectorioExento.test(ruta.replace(/\\/g, '/')))
            .filter(({ texto }) => texto.includes('className'))
            .filter(({ texto }) => !texto.includes('ofbol-page-enter'))
            .map(({ ruta }) => ruta);
        expect(ofensores).toEqual([]);
    });
});
