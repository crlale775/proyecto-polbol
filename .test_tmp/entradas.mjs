/**
 * Barrido de entrada de página.
 *
 * Solo 3 de 24 vistas usaban `.ofbol-page-enter` (el único momento animado por
 * pantalla, 320 ms, desde un estado ya visible). Se agrega al contenedor raíz:
 * el que trae el relleno de página (`p-6`), el ancho de lectura (`max-w-7xl`) y
 * el centrado (`mx-auto`). No se toca ningún contenedor interno.
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

let total = 0;

for (const ruta of archivos(RAIZ)) {
    const original = readFileSync(ruta, 'utf8');
    if (original.includes('ofbol-page-enter')) continue;

    let cambios = 0;
    const texto = original.replace(/(["`])((?:(?!\1)[\s\S])*)\1/g, (coincidencia, comilla, clases) => {
        const esRaiz = /\bp-6\b/.test(clases) && /max-w-7xl/.test(clases) && /mx-auto/.test(clases);
        if (!esRaiz || clases.includes('ofbol-page-enter')) return coincidencia;
        cambios += 1;
        return comilla + `${clases.trim()} ofbol-page-enter` + comilla;
    });

    if (cambios) {
        writeFileSync(ruta, texto);
        total += cambios;
        console.log(`${cambios} contenedor(es)  ${ruta}`);
    }
}

console.log(`\nTOTAL: ${total} vistas con entrada de página del sistema.`);
