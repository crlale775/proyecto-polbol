/**
 * AvatarFoto — Avatar institucional con foto del personal (oficial o usuario).
 * Muestra la foto desde /storage/{foto} si existe; si no, cae gracefully a las
 * iniciales con color de respaldo. Sirve para oficiales (con grado) y usuarios.
 *
 * Uso:
 *   <AvatarFoto foto={o.foto} nombre={`${o.nombres} ${o.apellidos}`} iniciales="JV" />
 *   <AvatarFoto foto={user.foto} nombre={user.usuario} iniciales={user.usuario?.[0]} />
 */
import React, { useState } from 'react';

export default function AvatarFoto({
    foto,
    nombre = '',
    iniciales = '',
    className = 'w-12 h-12 rounded-full text-sm',
    fallbackClassName = 'bg-emerald-800 text-white',
    ring = false,
}) {
    const src = foto ? `/storage/${foto}` : null;
    const [error, setError] = useState(false);

    const mostrarFoto = src && !error;
    const inicialesSeguras =
        iniciales ||
        (nombre
            ? nombre
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase())
                  .join('')
            : '?');

    return (
        <div
            className={`relative shrink-0 overflow-hidden flex items-center justify-center font-black uppercase select-none ${
                ring ? 'ring-2 ring-white/70 shadow-sm' : ''
            } ${mostrarFoto ? 'bg-slate-200' : `${fallbackClassName} text-white`} ${className}`}
            title={nombre || undefined}
        >
            {mostrarFoto ? (
                <img
                    src={src}
                    alt={nombre || 'Foto de perfil'}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={() => setError(true)}
                />
            ) : (
                <span>{inicialesSeguras}</span>
            )}
        </div>
    );
}
