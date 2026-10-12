/**
 * CampoDato — Par etiqueta/valor institucional (tema claro, estilo PolBol)
 * Uso: <CampoDato label="C.I." value="5129403-LP" mono />
 */
import React from 'react';

export default function CampoDato({ label, value, mono = false, className = '' }) {
    return (
        <div className={`bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 min-w-0 ${className}`}>
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-400">
                {label}
            </p>
            <p className={`mt-1 text-[13px] font-bold text-slate-900 truncate ${mono ? 'font-mono' : ''}`}>
                {value || '—'}
            </p>
        </div>
    );
}
