/**
 * OFBOL — Identidad sonora del sistema.
 *
 * Cada evento importante del sistema tiene SU propio sonido. No es un click
 * genérico pegado a cada botón: son señales cortas y sintetizadas (Web Audio,
 * cero archivos, cero peticiones) que distinguen de oído lo que ocurrió.
 *
 *     notificacion()  · llegó algo nuevo      (dos notas ascendentes, campana)
 *     enviar()        · se remitió algo       (barrido ascendente corto)
 *     exito()         · se confirmó algo      (arpegio mayor ascendente)
 *     advertencia()   · falta algo            (dos pulsos iguales)
 *     error()         · algo falló            (dos notas descendentes)
 *
 * Reglas de oficio:
 *   · Un solo AudioContext para toda la sesión (crear uno por sonido filtraba
 *     contextos y el navegador los bloquea).
 *   · Se desbloquea con el primer gesto real del usuario (política de autoplay).
 *   · El usuario puede silenciar el sistema; la preferencia se recuerda.
 *   · Con `prefers-reduced-motion` los sonidos arrancan silenciados salvo que
 *     el usuario los active a propósito.
 *   · Anti-ráfaga por evento: una señal no se repite más rápido de lo que el
 *     oído puede distinguir.
 */

const STORAGE_KEY = 'ofbol_sonido';

/** Señales: una definición por evento, sin valores sueltos en el código. */
const SENALES = {
    // Un memorándum nuevo entró al sistema: campana de dos notas.
    notificacion: { volumen: 0.045, notas: [
        { f: 987.77, t: 0,    d: 0.16, forma: 'sine' },
        { f: 1318.51, t: 0.10, d: 0.26, forma: 'sine' },
    ] },

    // Se remitió / envió algo: barrido ascendente, se va.
    enviar: { volumen: 0.05, notas: [
        { f: 392, t: 0, hin: 784, d: 0.20, forma: 'triangle' },
    ] },

    // Confirmación (aprobado, registrado, guardado): arpegio mayor que resuelve.
    exito: { volumen: 0.045, notas: [
        { f: 523.25, t: 0,    d: 0.12, forma: 'sine' },
        { f: 659.25, t: 0.08, d: 0.12, forma: 'sine' },
        { f: 783.99, t: 0.16, d: 0.24, forma: 'sine' },
    ] },

    // Falta un dato / validación: dos pulsos iguales, atención sin alarma.
    advertencia: { volumen: 0.04, notas: [
        { f: 587.33, t: 0,    d: 0.09, forma: 'triangle' },
        { f: 587.33, t: 0.14, d: 0.09, forma: 'triangle' },
    ] },

    // Algo falló: dos notas descendentes, grave.
    error: { volumen: 0.04, notas: [
        { f: 311.13, t: 0,    d: 0.14, forma: 'triangle' },
        { f: 233.08, t: 0.11, d: 0.22, forma: 'triangle' },
    ] },
};

let ctx = null;
let maestro = null;
let desbloqueado = false;
let silenciado = null; // null = aún sin preferencia explícita
const ultimaVez = {};  // anti-ráfaga por evento
const INTERVALO_MINIMO = 90; // ms

/** ¿El sistema operativo pide reducir animaciones? Es la señal más conservadora. */
function prefiereMenosMovimiento() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
}

function leerPreferencia() {
    if (silenciado !== null) return silenciado;
    try {
        const guardado = localStorage.getItem(STORAGE_KEY);
        if (guardado === 'on') { silenciado = false; return false; }
        if (guardado === 'off') { silenciado = true; return true; }
    } catch {
        /* almacenamiento no disponible */
    }
    // Sin preferencia explícita: se calla si el sistema pide reducir movimiento.
    silenciado = prefiereMenosMovimiento();
    return silenciado;
}

function asegurarContexto() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
        ctx = new AC();
        maestro = ctx.createGain();
        maestro.gain.value = 1;
        maestro.connect(ctx.destination);
        return ctx;
    } catch {
        ctx = null;
        return null;
    }
}

/** Una nota: oscilador + envolvente. Nada suena si el navegador aún no dejó. */
function tocarNota(c, nota, volumen) {
    const t0 = c.currentTime + (nota.t || 0);
    const dur = nota.d || 0.15;

    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = nota.forma || 'sine';
    osc.frequency.setValueAtTime(nota.f, t0);
    if (nota.hin) {
        osc.frequency.exponentialRampToValueAtTime(nota.hin, t0 + dur);
    }

    // Ataque instantáneo, caída exponencial: un "tick" limpio, sin cola.
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volumen, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(gain);
    gain.connect(maestro);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
}

const SoundManager = {
    /** Crea/reanuda el AudioContext. Llamado en el primer gesto del usuario. */
    desbloquear() {
        const c = asegurarContexto();
        if (!c) return;
        if (c.state === 'suspended') {
            c.resume().catch(() => {});
        }
        desbloqueado = true;
    },

    /** Preferencia del usuario. Se persiste. */
    silenciar(valor) {
        silenciado = !!valor;
        try {
            localStorage.setItem(STORAGE_KEY, silenciado ? 'off' : 'on');
        } catch {
            /* noop */
        }
    },

    alternarSilencio() {
        this.silenciar(!leerPreferencia());
        return leerPreferencia();
    },

    estaSilenciado() {
        return leerPreferencia();
    },

    /**
     * Reproduce un evento por nombre. Es el único punto de entrada: si no hay
     * contexto, si está silenciado o si se está repitiendo muy seguido, no pasa nada.
     */
    reproducir(evento) {
        const senal = SENALES[evento];
        if (!senal || leerPreferencia()) return;

        const ahora = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        if (ultimaVez[evento] && ahora - ultimaVez[evento] < INTERVALO_MINIMO) return;
        ultimaVez[evento] = ahora;

        const c = asegurarContexto();
        if (!c || c.state === 'suspended') {
            // El navegador todavía no autorizó audio: se intenta reanudar para
            // el próximo evento, pero este no se fuerza.
            if (c && desbloqueado) c.resume().catch(() => {});
            return;
        }

        try {
            senal.notas.forEach((nota) => tocarNota(c, nota, senal.volumen));
        } catch {
            /* audio no disponible: nunca romper la interfaz por un sonido */
        }
    },

    // ── Eventos con nombre (lo que usa la aplicación) ──────────────
    notificacion() { this.reproducir('notificacion'); },
    enviar()       { this.reproducir('enviar'); },
    exito()        { this.reproducir('exito'); },
    advertencia()  { this.reproducir('advertencia'); },
    error()        { this.reproducir('error'); },
};

export default SoundManager;
export { SoundManager };
