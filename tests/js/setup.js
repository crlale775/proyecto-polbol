/**
 * Shims de navegador para jsdom.
 *
 * Las vistas usan APIs que jsdom no implementa (matchMedia, AudioContext,
 * URL.createObjectURL, observadores). Sin ellas el render tira un error y la
 * prueba fallaría por el entorno, no por el código: acá se aíslan.
 */

// ── matchMedia (usado por SoundManager y por los layouts responsivos) ──
if (!window.matchMedia) {
    window.matchMedia = (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    });
}

// ── AudioContext (identidad sonora) ──
class AudioContextFalso {
    constructor() {
        this.currentTime = 0;
        this.state = 'running';
        this.destination = {};
    }
    createOscillator() {
        return {
            type: 'sine',
            frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
            connect() {},
            start() {},
            stop() {},
        };
    }
    createGain() {
        return {
            gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} },
            connect() {},
        };
    }
    resume() {
        return Promise.resolve();
    }
}
if (!window.AudioContext) window.AudioContext = AudioContextFalso;

// ── Object URLs (vista previa de PDF) ──
if (!URL.createObjectURL) URL.createObjectURL = () => 'blob:ofbol-test';
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {};

// ── Observadores y desplazamiento ──
if (!window.IntersectionObserver) {
    window.IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
}
if (!window.ResizeObserver) {
    window.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
}
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function () {};
