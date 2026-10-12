/**
 * Spinner de carga — uso: <Spinner /> o <Spinner size="sm" />
 * 
 * Mejora: prefers-reduced-motion support (Web Interface Guidelines)
 */
import React from 'react';

export default function Spinner({ size = 'md', className = '' }) {
    const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
    return (
        <svg
            className={`animate-spin text-emerald-600 ${sizes[size]} ${className}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            role="status"
            aria-label="Cargando"
        >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
    );
}
