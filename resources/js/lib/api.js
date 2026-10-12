/**
 * API Client — Wrapper ligero para fetch que conecta React con los Controllers de Laravel
 * Uso: import api from '@/lib/api';
 *      const data = await api.get('/documentos');
 *      const res  = await api.post('/documentos', { ... });
 */

import SoundManager from './sounds';

const API_BASE = '/api';

const headers = (extra = {}) => ({
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...extra,
});

/**
 * Evita el bucle infinito de alertas cuando la sesión PHP expira:
 * se notifica UNA sola vez y se redirige al login limpiando la sesión local.
 */
let sesionExpiradaNotificada = false;

function notificarSesionExpirada() {
    if (sesionExpiradaNotificada) return;
    sesionExpiradaNotificada = true;

    try {
        sessionStorage.removeItem('ofbol_user');
        localStorage.removeItem('ofbol_session_hora');
    } catch {
        /* almacenamiento no disponible */
    }

    // Los toasts/módulos escuchan este evento para avisar al usuario y redirigir.
    window.dispatchEvent(new CustomEvent('ofbol:sesion-expirada'));

    setTimeout(() => {
        if (!window.location.pathname.startsWith('/login')) {
            window.location.replace('/login');
        }
    }, 1200);
}

async function request(method, path, body = null, formData = false) {
    const opts = {
        method,
        headers: formData
            ? { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
            : headers(),
        credentials: 'same-origin',
    };

    if (body) {
        opts.body = formData ? body : JSON.stringify(body);
    }

    let res;
    try {
        res = await fetch(`${API_BASE}${path}`, opts);
    } catch (red) {
        // Red caída / servidor apagado: mensaje claro en vez de "Error undefined".
        SoundManager.error();
        throw new Error('No hay conexión con el servidor. Verifique su red e intente de nuevo.');
    }

    if (!res.ok) {
        if (res.status === 401) {
            notificarSesionExpirada();
        }
        const json = await res.json().catch(() => null);
        const err = new Error(json?.message || `Error ${res.status}`);
        err.status = res.status;
        err.errors = json?.errors || null;

        // El sistema tiene un sonido por tipo de fallo: la sesión vencida y la
        // validación de un formulario avisan distinto de una caída real.
        if (res.status === 401 || res.status === 422) {
            SoundManager.advertencia();
        } else {
            SoundManager.error();
        }

        throw err;
    }

    return res.json().catch(() => null);
}

const api = {
    get:    (path)             => request('GET',    path),
    post:   (path, body)       => request('POST',   path, body),
    put:    (path, body)       => request('PUT',    path, body),
    patch:  (path, body)       => request('PATCH',  path, body),
    delete: (path, body)       => request('DELETE', path, body),
    upload: (path, formData)   => request('POST',   path, formData, true),
};

export default api;
