/**
 * Badge de estado — usa la paleta de ESTADOS de ofbol.js
 */
import React from 'react';
import { ESTADOS } from '../../constants/ofbol';

export default function EstadoBadge({ nombre }) {
    const config = ESTADOS[nombre] ?? {
        label: nombre,
        color: 'bg-slate-100 text-slate-600',
        dot: 'bg-slate-400',
    };

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
            {config.label}
        </span>
    );
}
