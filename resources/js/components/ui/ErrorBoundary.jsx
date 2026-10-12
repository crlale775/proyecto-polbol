/**
 * ErrorBoundary — Barrera global de errores de React.
 *
 * Antes: cualquier excepción en el render desmontaba TODA la app y el usuario
 * veía la pantalla en blanco (obligado a recargar). Ahora el error se muestra
 * en un panel legible, con opción de reintentar (recuperar el estado) o
 * recargar la página, y queda registrado en consola para depuración.
 *
 * La superficie usa los tokens institucionales (borde para la estructura,
 * sombra solo para lo que flota) y el fallo se oye con su propio sonido.
 */
import React from 'react';
import SoundManager from '../../lib/sounds';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('[OFBOL] Error de interfaz capturado:', error, info);
        SoundManager.error();
    }

    render() {
        if (this.state.error) {
            return (
                <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'radial-gradient(ellipse at top, #fbfaf7 0%, #f8f7f4 40%, #f6f4ef 100%)' }}>
                    <div className="ofbol-elevated w-full max-w-lg p-8 text-center ofbol-page-enter">
                        <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto"
                            style={{ background: 'var(--ofbol-crimson-wash)', color: 'var(--ofbol-crimson)' }}
                            aria-hidden="true"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                            </svg>
                        </div>

                        <h1 className="ofbol-display mt-5">Algo se interrumpió</h1>
                        <p className="ofbol-nota mx-auto mt-2">
                            Un error inesperado detuvo esta pantalla. Sus datos siguen a salvo:
                            reintente para recuperar el estado o recargue la página.
                        </p>

                        <pre className="mt-5 text-left text-[11px] leading-relaxed font-mono break-words whitespace-pre-wrap rounded-xl border p-3"
                            style={{ background: '#faf9f5', borderColor: 'var(--ofbol-line)', color: 'var(--ofbol-ink-soft)' }}>
                            {String(this.state.error?.message || this.state.error)}
                        </pre>

                        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-5">
                            <button
                                type="button"
                                onClick={() => this.setState({ error: null })}
                                className="ofbol-btn-primary"
                            >
                                Reintentar
                            </button>
                            <button
                                type="button"
                                onClick={() => window.location.reload()}
                                className="ofbol-btn-ghost justify-center"
                            >
                                Recargar página
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
