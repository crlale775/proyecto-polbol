/**
 * Pruebas de COMPORTAMIENTO de MisDocumentos.
 *
 * Las de `vistas.test.jsx` solo prueban que la vista renderiza. Estas prueban
 * que hace lo que promete: filtrar, ordenar y paginar. La del orden es una
 * prueba de regresión: `toSorted` devuelve un arreglo nuevo y el código
 * descartaba el resultado, así que el selector existía pero no ordenaba nada.
 */
import React from 'react';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, afterEach, vi } from 'vitest';

import { AuthProvider } from '../../resources/js/context/AuthContext';
import MisDocumentos from '../../resources/views/secretario_unidad/MisDocumentos';

vi.mock('../../resources/js/lib/api.js', () => {
    // 12 trámites: fechas distintas y crecientes (01-01 … 01-09, 02-01 … 02-03)
    // para poder comprobar el orden en las dos direcciones.
    const DOCUMENTOS = Array.from({ length: 12 }, (_, i) => {
        const n = i + 1;
        const mes = n <= 9 ? '01' : '02';
        const dia = String(n <= 9 ? n : n - 9).padStart(2, '0');
        return {
            id_documento: n,
            id_epi: 1,
            id_tipo: 1,
            codigo_documento: `MEM-EPI1-2026-${String(n).padStart(3, '0')}`,
            referencia: `Referencia ${n}`,
            fecha_subida: `2026-${mes}-${dia}T10:00:00Z`,
            estado: { nombre: 'Borrador' },
            oficial: { nombres: `Oficial ${n}`, apellidos: 'Prueba', ci: `1000${n}` },
            tipo_documento: { nombre: 'Permiso' },
            ruta_pdf: `docs/${n}.pdf`,
            hash: 'a'.repeat(64),
        };
    });

    const MAPA = {
        '/documentos': DOCUMENTOS,
        '/tipos-documento': [],
        '/estados-documento': [],
        '/revisiones': [],
    };

    const resolver = (valor) => Promise.resolve(valor);
    return {
        default: {
            get: (path) => resolver(MAPA[String(path).split('?')[0]] ?? []),
            post: () => resolver({}),
            put: () => resolver({}),
            patch: () => resolver({}),
            delete: () => resolver({}),
            upload: () => resolver({}),
        },
    };
});

function montar() {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem(
        'ofbol_user',
        JSON.stringify({
            id_usuario: 1,
            usuario: 'sec_sanpedro',
            rol: 'Secretario EPI',
            id_epi: 1,
            epi: 'EPI 1 San Pedro',
        })
    );

    return render(
        <MemoryRouter>
            <AuthProvider>
                <MisDocumentos />
            </AuthProvider>
        </MemoryRouter>
    );
}

/** Filas del cuerpo de la tabla, sin la cabecera. */
const filas = () => document.querySelectorAll('tbody tr');
/** Código del trámite de la primera fila ("—" si no hay filas). */
const primerCodigo = () => filas()[0]?.querySelector('td')?.textContent?.trim() ?? null;

describe('MisDocumentos · comportamiento', () => {
    afterEach(() => {
        cleanup();
        sessionStorage.clear();
        localStorage.clear();
    });

    it('pagina de a 10 y muestra el total de páginas', async () => {
        montar();
        await screen.findByText('MEM-EPI1-2026-012');

        expect(filas()).toHaveLength(10);
        expect(screen.getByText(/Página 1 de 2/)).toBeTruthy();
        expect(screen.getByText(/12 resultados/)).toBeTruthy();
    });

    it('el buscador filtra por nombre del oficial', async () => {
        montar();
        await screen.findByText('MEM-EPI1-2026-012');

        fireEvent.change(screen.getByLabelText('Buscar por código, referencia u oficial'), {
            target: { value: 'Oficial 3' },
        });

        expect(filas()).toHaveLength(1);
        expect(primerCodigo()).toBe('MEM-EPI1-2026-003');
    });

    it('el buscador filtra por código', async () => {
        montar();
        await screen.findByText('MEM-EPI1-2026-012');

        fireEvent.change(screen.getByLabelText('Buscar por código, referencia u oficial'), {
            target: { value: '2026-007' },
        });

        expect(filas()).toHaveLength(1);
        expect(primerCodigo()).toBe('MEM-EPI1-2026-007');
    });

    it('ordena por fecha descendente y ascendente (regresión del `toSorted` descartado)', async () => {
        montar();
        await screen.findByText('MEM-EPI1-2026-012');

        // Por defecto: el más reciente primero.
        expect(primerCodigo()).toBe('MEM-EPI1-2026-012');

        fireEvent.change(screen.getByLabelText('Criterio de orden'), {
            target: { value: 'fecha_asc' },
        });

        // Antes del arreglo, este cambio no movía una sola fila.
        expect(primerCodigo()).toBe('MEM-EPI1-2026-001');
    });

    it('ordena por código', async () => {
        montar();
        await screen.findByText('MEM-EPI1-2026-012');

        fireEvent.change(screen.getByLabelText('Criterio de orden'), {
            target: { value: 'codigo' },
        });

        expect(primerCodigo()).toBe('MEM-EPI1-2026-001');
    });

    it('avanza a la segunda página', async () => {
        montar();
        await screen.findByText('MEM-EPI1-2026-012');

        fireEvent.click(screen.getByText(/Siguiente/));

        // Quedan 2 de los 12 trámites.
        expect(filas()).toHaveLength(2);
        expect(screen.getByText(/Página 2 de 2/)).toBeTruthy();
    });

    it('no ofrece paginar cuando hay una sola página', async () => {
        montar();
        await screen.findByText('MEM-EPI1-2026-012');

        fireEvent.change(screen.getByLabelText('Buscar por código, referencia u oficial'), {
            target: { value: 'MEM-EPI1-2026-005' },
        });

        expect(filas()).toHaveLength(1);
        expect(screen.queryByText(/Siguiente/)).toBeNull();
    });

    it('muestra el estado vacío y permite limpiar los filtros', async () => {
        montar();
        await screen.findByText('MEM-EPI1-2026-012');

        fireEvent.change(screen.getByLabelText('Buscar por código, referencia u oficial'), {
            target: { value: 'no-existe-nada' },
        });

        expect(filas()).toHaveLength(0);
        expect(screen.getByText('Sin resultados')).toBeTruthy();

        fireEvent.click(screen.getByText(/Limpiar filtros/));

        expect(filas()).toHaveLength(10);
    });

    it('la tabla expone encabezados accesibles', async () => {
        montar();
        await screen.findByText('MEM-EPI1-2026-012');

        const tabla = screen.getByRole('table');
        expect(within(tabla).getByText('Código')).toBeTruthy();
        expect(within(tabla).getByText('Estado')).toBeTruthy();
    });
});
