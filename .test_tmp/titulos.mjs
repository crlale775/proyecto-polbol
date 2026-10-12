/**
 * Barrido de títulos de página.
 *
 * El sistema reserva UN momento tipográfico grande por pantalla
 * (`.ofbol-display`, 26–38 px, peso 900, tracking -0.025em). Las vistas venían
 * con seis variantes distintas de título (`text-2xl font-black`,
 * `text-xl font-bold`, e incluso un `uppercase` que grita el encabezado).
 * Acá todas convergen a la misma pieza, y el encabezado deja de estar en
 * mayúsculas sostenidas (tell de página generada).
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

/** Variantes reales encontradas, todas al mismo destino. */
const VARIANTES = [
    /className="text-2xl font-black text-slate-900 tracking-tight"/g,
    /className="text-2xl font-bold text-slate-900"/g,
    /className="text-xl font-bold text-slate-900"/g,
    /className="text-2xl sm:text-3xl font-black uppercase tracking-tight mt-3"/g,
    /className="text-\[26px\] font-black tracking-tight text-\[#0a0f0d\] heading-balance"/g,
];

const DESTINO = 'className="ofbol-display heading-balance"';

let total = 0;

for (const ruta of archivos(RAIZ)) {
    const original = readFileSync(ruta, 'utf8');
    let texto = original;
    let cambios = 0;

    for (const variante of VARIANTES) {
        const encontrados = (texto.match(variante) || []).length;
        if (encontrados) {
            texto = texto.replace(variante, DESTINO);
            cambios += encontrados;
        }
    }

    if (cambios) {
        writeFileSync(ruta, texto);
        total += cambios;
        console.log(`${cambios} título(s)  ${ruta}`);
    }
}

console.log(`\nTOTAL: ${total} títulos normalizados a .ofbol-display.`);
