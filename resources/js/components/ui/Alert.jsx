/**
 * Alert reutilizable — tipo: success | warning | error | info
 * 
 * Mejoras UX/Accesibilidad (Web Interface Guidelines):
 * - aria-live="polite" para actualizaciones asíncronas
 * - aria-label en botón de cierre
 * - Focus visible en botón de cierre
 */
import React from 'react';

const CONFIG = {
    success: {
        bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        icon: (
            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
        ),
    },
    warning: {
        bg: 'bg-amber-50 border-amber-200 text-amber-800',
        icon: (
            <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
        ),
    },
    error: {
        bg: 'bg-red-50 border-red-200 text-red-800',
        icon: (
            <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
        ),
    },
    info: {
        bg: 'bg-blue-50 border-blue-200 text-blue-800',
        icon: (
            <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
            </svg>
        ),
    },
};

export default function Alert({ type = 'info', title, children, onClose }) {
    const { bg, icon } = CONFIG[type] ?? CONFIG.info;
    return (
        <div
            className={`flex gap-3 rounded-xl border px-4 py-3 text-sm ${bg}`}
            role="alert"
            aria-live="polite"
        >
            <span className="mt-0.5">{icon}</span>
            <div className="flex-1 min-w-0">
                {title && <p className="font-semibold mb-0.5">{title}</p>}
                <div>{children}</div>
            </div>
            {onClose && (
                <button
                    onClick={onClose}
                    className="shrink-0 opacity-60 hover:opacity-100 transition-opacity focus-visible:ring-2 focus-visible:ring-current rounded"
                    aria-label="Cerrar alerta"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}
        </div>
    );
}
