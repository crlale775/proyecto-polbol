/**
 * PerfilInstitucional — ficha de identidad de los tres niveles de mando.
 *
 * Los tres perfiles (EPI, Comando Departamental, Comando General) eran el mismo
 * archivo copiado tres veces, con diferencias solo de copy y de acento. Acá hay
 * una sola anatomía y cada vista aporta lo suyo (el cambio de foto, la nota de
 * competencia).
 *
 * Reglas de oficio aplicadas:
 *   · Color plano en la franja de identidad: sin gradiente decorativo (R1).
 *   · Sin vidrio ni blur de adorno: las insignias son color plano (R1/R2).
 *   · Los datos van en fichas (`ChipsDato`), no en tarjetas repetidas (R4).
 *   · Borde para la estructura; la sombra queda para lo que flota (R10).
 */
import React from 'react';
import { ChipsDato } from './Graficos';

const TONOS = {
    oliva: { background: 'var(--ofbol-olive-wash)', color: 'var(--ofbol-olive)' },
    ambar: { background: 'var(--ofbol-amber-wash)', color: '#7f5a07' },
    teal: { background: 'var(--ofbol-teal-wash)', color: 'var(--ofbol-teal)' },
    crimson: { background: 'var(--ofbol-crimson-wash)', color: 'var(--ofbol-crimson)' },
    papel: { background: 'rgba(255, 255, 255, 0.10)', color: '#fbfaf6' },
};

export default function PerfilInstitucional({
    titulo,
    nota,
    acento = '#8a9a6d',
    avatar,
    nombreMostrado,
    correoMostrado,
    rolMostrado,
    insignias = [],
    datos = [],
    children,
}) {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="ofbol-display heading-balance">{titulo}</h1>
                {nota && <p className="ofbol-nota mt-2">{nota}</p>}
            </div>

            <section className="ofbol-card overflow-hidden">
                {/* Franja de identidad: un solo color plano, deliberado. */}
                <div
                    className="px-6 py-6 flex flex-col sm:flex-row items-center gap-5"
                    style={{ background: '#0f1613' }}
                >
                    {avatar && <div className="relative shrink-0">{avatar}</div>}

                    <div className="text-center sm:text-left min-w-0">
                        <h2 className="text-lg font-black text-white truncate">{nombreMostrado}</h2>
                        {correoMostrado && (
                            <p className="text-xs font-semibold mt-0.5" style={{ color: acento }}>
                                {correoMostrado}
                            </p>
                        )}
                        <div className="mt-2.5 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                            <span className="ofbol-badge" style={TONOS.papel}>
                                {rolMostrado}
                            </span>
                            {insignias.map((insignia) => (
                                <span
                                    key={insignia.texto}
                                    className="ofbol-badge"
                                    style={TONOS[insignia.tono] ?? TONOS.oliva}
                                >
                                    {insignia.texto}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {datos.length > 0 && (
                    <div className="p-5">
                        <ChipsDato datos={datos} />
                    </div>
                )}
            </section>

            {children}
        </div>
    );
}
