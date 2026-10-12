/**
 * Barrido mecánico del sistema de diseño sobre las vistas.
 *
 * Reglas (todas verificables y sin criterio subjetivo):
 *  1. `rounded-2xl` / `rounded-3xl` → `rounded-[14px]`: la escala de radios del
 *     sistema va de 12 a 16 px; 24 y 32 px son el radio genérico de IA.
 *  2. Se quita `shadow-*` SOLO cuando la misma cadena de clases ya trae `border`
 *     (regla R10: borde para la estructura, sombra para lo que flota — nunca
 *     los dos apilados). Así no se aplana una pestaña activa, que sí se eleva.
 *  3. Sangrado/espacios: no se toca nada de color ni de foco, que ya resuelven
 *     por el remapeo de la paleta y el anillo global.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = 'resources/views';

function archivos(dir) {
    return readdirSync(dir).flatMap((entrada) => {
        const ruta = join(dir, entrada);
        if (statSync(ruta).isDirectory()) return archivos(ruta);
        return ruta.endsWith('.jsx') ? [ruta] : [];
    });
}

const SOMBRA = /\b(?:hover:)?shadow-(?:sm|md|lg|xl|2xl|2xs|xs)\b/g;

let totalRadios = 0;
let totalSombras = 0;

for (const ruta of archivos(RAIZ)) {
    const original = readFileSync(ruta, 'utf8');
    let texto = original;

    // Regla 1 — radios fuera de escala.
    const radios = (texto.match(/rounded-(?:2xl|3xl)/g) || []).length;
    if (radios) {
        texto = texto.replace(/rounded-(?:2xl|3xl)/g, 'rounded-[14px]');
        totalRadios += radios;
    }

    // Regla 2 — quitar la sombra apilada, no la que eleva de verdad.
    let sombras = 0;
    texto = texto.replace(/(["`])((?:(?!\1).)*)\1/gs, (coincidencia, comilla, clases) => {
        if (!/border/.test(clases) || !SOMBRA.test(clases)) return coincidencia;
        SOMBRA.lastIndex = 0;
        const limpias = clases.replace(SOMBRA, ' ').replace(/\s{2,}/g, ' ').trim();
        sombras += (clases.match(SOMBRA) || []).length;
        return comilla + limpias + comilla;
    });
    SOMBRA.lastIndex = 0;
    totalSombras += sombras;

    if (texto !== original) {
        writeFileSync(ruta, texto);
        console.log(`${String(radios).padStart(3)} radios · ${String(sombras).padStart(2)} sombras  ${ruta}`);
    }
}

console.log(`\nTOTAL: ${totalRadios} radios fuera de escala · ${totalSombras} sombras apiladas sobre borde.`);
