/**
 * Pruebas de humo de TODAS las vistas del sistema OFBOL.
 *
 * Por qué existen: `vite build` valida sintaxis, pero NO detecta un símbolo no
 * definido (un icono sin importar, una primitiva mal referenciada). Ese error
 * solo aparece al renderizar. Estas pruebas montan cada vista real, con la
 * sesión sembrada y la API simulada, y fallan si el render lanza.
 */
import React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { AuthProvider } from '../../resources/js/context/AuthContext';

// ── API simulada: ninguna vista debe salir a la red en una prueba ──
vi.mock('../../resources/js/lib/api.js', () => {
    /**
     * El contrato importa: `/tipos-memo` NO devuelve un arreglo sino un objeto
     * con cuatro colecciones. Simular un arreglo ahí no probaba la vista,
     * probaba un contrato que no existe. (Va dentro del factory: `vi.mock` se
     * hoistea por encima de cualquier constante del archivo.)
     */
    const RESPUESTAS = {
        '/tipos-memo': { memos: [], mas_usados: [], sugerencias: [], tipos_documento: [] },
    };

    const resolver = (valor) => Promise.resolve(valor);
    return {
        default: {
            get: (path) => {
                const ruta = String(path).split('?')[0];
                return resolver(RESPUESTAS[ruta] ?? []);
            },
            post: () => resolver({}),
            put: () => resolver({}),
            patch: () => resolver({}),
            delete: () => resolver({}),
            upload: () => resolver({}),
        },
    };
});

// ── Vistas: Secretaría EPI ──
import EPIDashboard from '../../resources/views/secretario_unidad/Dashboard';
import EPISubir from '../../resources/views/secretario_unidad/SubirDocumento';
import EPIMisDocumentos from '../../resources/views/secretario_unidad/MisDocumentos';
import EPICorrecciones from '../../resources/views/secretario_unidad/Correcciones';
import EPIOficiales from '../../resources/views/secretario_unidad/OficialesEpi';
import EPIHistorial from '../../resources/views/secretario_unidad/Historial';
import EPIPlantillas from '../../resources/views/secretario_unidad/Plantillas';
import EPIReportes from '../../resources/views/secretario_unidad/Reportes';
import EPINotificaciones from '../../resources/views/secretario_unidad/Notificaciones';
import EPIPerfil from '../../resources/views/secretario_unidad/Perfil';

// ── Vistas: Comando Departamental ──
import DptalDashboard from '../../resources/views/secretario_comando_departamental/Dashboard';
import DptalRevisar from '../../resources/views/secretario_comando_departamental/RevisarDocumentos';
import DptalObservaciones from '../../resources/views/secretario_comando_departamental/Observaciones';
import DptalHistorial from '../../resources/views/secretario_comando_departamental/Historial';
import DptalTrazabilidad from '../../resources/views/secretario_comando_departamental/Trazabilidad';
import DptalDocsPorEpi from '../../resources/views/secretario_comando_departamental/DocumentosPorEpi';
import DptalDesempenio from '../../resources/views/secretario_comando_departamental/DesempenioEpis';
import DptalGestionSecretarios from '../../resources/views/secretario_comando_departamental/GestionSecretarios';
import DptalReportes from '../../resources/views/secretario_comando_departamental/Reportes';
import DptalNotificaciones from '../../resources/views/secretario_comando_departamental/Notificaciones';
import DptalPerfil from '../../resources/views/secretario_comando_departamental/Perfil';

// ── Vistas: Comando General ──
import GenDashboard from '../../resources/views/comando_general/Dashboard';
import GenDocumentos from '../../resources/views/comando_general/DocumentosAprobados';
import GenRegistro from '../../resources/views/comando_general/RegistroDocumental';
import GenTiposMemo from '../../resources/views/comando_general/GestionTiposMemo';
import GenHistorial from '../../resources/views/comando_general/Historial';
import GenTrazabilidad from '../../resources/views/comando_general/Trazabilidad';
import GenComparativo from '../../resources/views/comando_general/ComparativoGeneral';
import GenDirectorio from '../../resources/views/comando_general/DirectorioInstitucional';
import GenUsuarios from '../../resources/views/comando_general/GestionUsuarios';
import GenRegistroOficiales from '../../resources/views/comando_general/RegistroOficialesIA';
import GenAuditoria from '../../resources/views/comando_general/Auditoria';
import GenReportes from '../../resources/views/comando_general/Reportes';
import GenNotificaciones from '../../resources/views/comando_general/Notificaciones';
import GenPerfil from '../../resources/views/comando_general/Perfil';

// ── Autenticación y registro público ──
import Login from '../../resources/views/login/Login';
import AuthLogin from '../../resources/views/auth/Login';
import LoginRegistroOficial from '../../resources/views/login/RegistroOficial';
import PublicoRegistroOficial from '../../resources/views/publico/RegistroOficial';

const USUARIOS = {
    epi: { id_usuario: 1, usuario: 'sec_sanpedro', rol: 'Secretario EPI', id_epi: 1, epi: 'EPI 1 San Pedro', estado: true },
    dptal: { id_usuario: 2, usuario: 'revisor_lapaz', rol: 'Secretario Comando Departamental', id_epi: null, epi: 'Comando Departamental La Paz', estado: true },
    general: { id_usuario: 3, usuario: 'comando_general', rol: 'Comando General', id_epi: null, epi: 'Comando General de la Policía Boliviana', estado: true },
};

/** Monta una vista con la sesión sembrada, sin provider de toasts ni sondeo en vivo. */
async function montar(Componente, usuario = 'epi', ruta = '/') {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('ofbol_user', JSON.stringify(USUARIOS[usuario]));

    const utils = render(
        <MemoryRouter initialEntries={[ruta]}>
            <AuthProvider>
                <Componente />
            </AuthProvider>
        </MemoryRouter>
    );

    // Deja resolver las promesas de la API simulada antes de medir el resultado.
    await act(async () => {
        await new Promise((resolver) => setTimeout(resolver, 0));
    });

    return utils;
}

const VISTAS = [
    // Rol 1 — Secretaría EPI
    ['EPI · Dashboard', EPIDashboard, 'epi'],
    ['EPI · SubirDocumento', EPISubir, 'epi'],
    ['EPI · MisDocumentos', EPIMisDocumentos, 'epi'],
    ['EPI · Correcciones', EPICorrecciones, 'epi'],
    ['EPI · OficialesEpi', EPIOficiales, 'epi'],
    ['EPI · Historial', EPIHistorial, 'epi'],
    ['EPI · Plantillas', EPIPlantillas, 'epi'],
    ['EPI · Reportes', EPIReportes, 'epi'],
    ['EPI · Notificaciones', EPINotificaciones, 'epi'],
    ['EPI · Perfil', EPIPerfil, 'epi'],

    // Rol 2 — Comando Departamental
    ['Dptal · Dashboard', DptalDashboard, 'dptal'],
    ['Dptal · RevisarDocumentos', DptalRevisar, 'dptal'],
    ['Dptal · Observaciones', DptalObservaciones, 'dptal'],
    ['Dptal · Historial', DptalHistorial, 'dptal'],
    ['Dptal · Trazabilidad', DptalTrazabilidad, 'dptal'],
    ['Dptal · DocumentosPorEpi', DptalDocsPorEpi, 'dptal'],
    ['Dptal · DesempenioEpis', DptalDesempenio, 'dptal'],
    ['Dptal · GestionSecretarios', DptalGestionSecretarios, 'dptal'],
    ['Dptal · Reportes', DptalReportes, 'dptal'],
    ['Dptal · Notificaciones', DptalNotificaciones, 'dptal'],
    ['Dptal · Perfil', DptalPerfil, 'dptal'],

    // Rol 3 — Comando General
    ['General · Dashboard', GenDashboard, 'general'],
    ['General · DocumentosAprobados', GenDocumentos, 'general'],
    ['General · RegistroDocumental', GenRegistro, 'general'],
    ['General · GestionTiposMemo', GenTiposMemo, 'general'],
    ['General · Historial', GenHistorial, 'general'],
    ['General · Trazabilidad', GenTrazabilidad, 'general'],
    ['General · ComparativoGeneral', GenComparativo, 'general'],
    ['General · DirectorioInstitucional', GenDirectorio, 'general'],
    ['General · GestionUsuarios', GenUsuarios, 'general'],
    ['General · RegistroOficialesIA', GenRegistroOficiales, 'general'],
    ['General · Auditoria', GenAuditoria, 'general'],
    ['General · Reportes', GenReportes, 'general'],
    ['General · Notificaciones', GenNotificaciones, 'general'],
    ['General · Perfil', GenPerfil, 'general'],

    // Autenticación y registro público
    ['Auth · Login', Login, 'epi'],
    ['Auth · Login (duplicado en /auth)', AuthLogin, 'epi'],
    ['Registro público (login)', LoginRegistroOficial, 'epi'],
    ['Registro público (publico)', PublicoRegistroOficial, 'epi'],
];

describe('Vistas OFBOL · render', () => {
    afterEach(() => {
        cleanup();
        sessionStorage.clear();
        localStorage.clear();
    });

    it.each(VISTAS)('%s renderiza sin lanzar', async (_nombre, Componente, usuario) => {
        const { container } = await montar(Componente, usuario);
        expect(container.firstChild).not.toBeNull();
        expect(container.textContent.trim().length).toBeGreaterThan(0);
    });

    it.each(VISTAS)('%s no renderiza un error de referencia', async (_nombre, Componente, usuario) => {
        const { container } = await montar(Componente, usuario);
        const texto = container.textContent;
        // Un símbolo sin importar o un dato suelto salen a la vista como esto:
        expect(texto).not.toMatch(/\bundefined\b/i);
        expect(texto).not.toMatch(/\bis not defined\b/i);
        expect(texto).not.toMatch(/\bNaN\b/);
    });
});
