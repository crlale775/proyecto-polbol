/**
 * Modal genérico reutilizable — la superficie flotante del sistema OFBOL.
 * Uso: <Modal open={open} onClose={() => setOpen(false)} title="Título">…</Modal>
 *
 * Criterio de oficio (craft R10): el borde es para la estructura y la sombra
 * para lo que flota. Un modal flota, así que lleva `.ofbol-elevated` (una sola
 * sombra, calculada) y no una tarjeta con borde + sombra apilados.
 *
 * Accesibilidad (Web Interface Guidelines):
 * - overscroll-behavior: contain (evita el encadenado de scroll)
 * - role="dialog", aria-modal, aria-labelledby
 * - Escape para cerrar y foco al primer elemento enfocable
 */
import React, { useEffect, useRef } from 'react';

export default function Modal({ open, onClose, title, children, size = 'md' }) {
    const sizes = {
        sm: 'max-w-sm',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
    };

    const panelRef = useRef(null);

    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
            // Foco al primer elemento enfocable del panel.
            const timer = setTimeout(() => {
                const firstFocusable = panelRef.current?.querySelector(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                firstFocusable?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
        document.body.style.overflow = '';
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    // Escape cierra.
    useEffect(() => {
        if (!open) return undefined;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
        >
            {/* Velo: aísla el contexto y apaga lo de atrás sin decorar. */}
            <div
                className="absolute inset-0 ofbol-animate-fade-in"
                style={{ background: 'rgba(20, 24, 26, 0.42)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
                onClick={onClose}
                aria-hidden="true"
            />

            <div
                ref={panelRef}
                className={`ofbol-elevated ofbol-animate-scale-in relative w-full ${sizes[size] ?? sizes.md} max-h-[90vh] flex flex-col overscroll-contain`}
                style={{ borderRadius: '14px', isolation: 'isolate' }}
            >
                <div
                    className="flex items-center justify-between px-5 py-3.5 shrink-0"
                    style={{ borderBottom: '1px solid var(--ofbol-line)' }}
                >
                    <h2
                        id="modal-title"
                        className="heading-balance"
                        style={{ fontSize: '15px', fontWeight: 900, letterSpacing: '-0.01em', color: 'var(--ofbol-ink)' }}
                    >
                        {title}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg transition-colors shrink-0"
                        style={{ color: 'var(--ofbol-slate)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ofbol-olive-wash)'; e.currentTarget.style.color = 'var(--ofbol-olive)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ofbol-slate)'; }}
                        aria-label="Cerrar"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 px-5 py-4 overscroll-contain ofbol-scroll">
                    {children}
                </div>
            </div>
        </div>
    );
}
