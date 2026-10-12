/**
 * Escudo — Escudo institucional de la Policía Boliviana (SVG)
 * Uso: <Escudo className="w-9 h-9" />
 */
import React, { useId } from 'react';

export default function Escudo({ className = 'w-9 h-9' }) {
    const uid = useId().replace(/:/g, '');

    return (
        <svg viewBox="0 0 64 64" className={className} aria-label="Escudo Policía Boliviana" role="img">
            <defs>
                <clipPath id={`escudo-inner-${uid}`}>
                    <path d="M32 7.5 L53.5 13 V30 C53.5 42.8 44.3 52.3 32 57 C19.7 52.3 10.5 42.8 10.5 30 V13 Z" />
                </clipPath>
            </defs>

            {/* Contorno del escudo */}
            <path
                d="M32 1.5 L59 9 V30 C59 46.5 47.5 58.5 32 63.5 C16.5 58.5 5 46.5 5 30 V9 Z"
                fill="#2a351a"
                stroke="#c9a227"
                strokeWidth="2.5"
            />

            {/* Interior */}
            <g clipPath={`url(#escudo-inner-${uid})`}>
                <rect x="0" y="0" width="64" height="64" fill="#faf9f5" />
                {/* Banda tricolor diagonal */}
                <g transform="rotate(28 32 32)">
                    <rect x="17" y="-8" width="9.5" height="80" fill="#d52b1e" />
                    <rect x="26.5" y="-8" width="9.5" height="80" fill="#f9b233" />
                    <rect x="36" y="-8" width="9.5" height="80" fill="#007a33" />
                </g>
            </g>

            {/* Estrella central */}
            <path
                d="M32 26.5 L34.3 31.2 L39.4 32 L35.7 35.6 L36.6 40.7 L32 38.3 L27.4 40.7 L28.3 35.6 L24.6 32 L29.7 31.2 Z"
                fill="#2a351a"
                stroke="#c9a227"
                strokeWidth="1"
            />

            {/* Filete superior */}
            <path
                d="M32 1.5 L59 9 V30 C59 46.5 47.5 58.5 32 63.5 C16.5 58.5 5 46.5 5 30 V9 Z"
                fill="none"
                stroke="#e8c34a"
                strokeWidth="0.8"
                opacity="0.55"
            />
        </svg>
    );
}
