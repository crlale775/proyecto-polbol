/**
 * ConfirmDialog — confirmación diseñada para acciones irreversibles.
 *
 * Reemplaza a `window.confirm()`, que rompe la identidad del sistema, no se
 * puede tematizar y no describe el efecto de la acción. Acá el aviso dice
 * exactamente qué va a pasar y con qué consecuencia (craft R11 · acciones
 * destructivas piden confirmación explícita, nunca inmediata).
 *
 * Uso:
 *   <ConfirmDialog
 *       open={!!pendiente}
 *       tono="crimson"
 *       titulo="Devolver el trámite"
 *       mensaje="El documento volverá a la EPI con la observación escrita."
 *       confirmarTexto="Devolver"
 *       procesando={procesando}
 *       onConfirmar={handleConfirmar}
 *       onCancelar={() => setPendiente(null)}
 *   />
 */
import React, { useCallback, useState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import Modal from './Modal';

const TONOS = {
    oliva:   { color: 'var(--ofbol-olive)',   wash: 'var(--ofbol-olive-wash)',   Icono: Check,         btn: 'ofbol-btn-primary' },
    teal:    { color: 'var(--ofbol-teal)',    wash: 'var(--ofbol-teal-wash)',    Icono: Check,         btn: 'ofbol-btn-primary' },
    ambar:   { color: 'var(--ofbol-amber)',   wash: 'var(--ofbol-amber-wash)',   Icono: AlertTriangle, btn: 'ofbol-btn-primary' },
    crimson: { color: 'var(--ofbol-crimson)', wash: 'var(--ofbol-crimson-wash)', Icono: AlertTriangle, btn: 'ofbol-btn-danger' },
};

/**
 * useConfirmar — reemplazo directo de `window.confirm()` para componentes.
 *
 * Devuelve `pedir(opciones)` (una promesa que resuelve true/false) y el
 * elemento a montar. Así el flujo queda lineal:
 *
 *   if (!await pedir({ titulo, mensaje, tono: 'crimson' })) return;
 *
 * y en el render se agrega `{Confirmacion}`.
 */
export function useConfirmar() {
    const [peticion, setPeticion] = useState(null);

    const pedir = useCallback(
        (opciones) => new Promise((resolve) => setPeticion({ opciones, resolve })),
        []
    );

    const resolver = (resultado) => {
        peticion?.resolve(resultado);
        setPeticion(null);
    };

    const Confirmacion = peticion ? (
        <ConfirmDialog
            open
            {...peticion.opciones}
            onConfirmar={() => resolver(true)}
            onCancelar={() => resolver(false)}
        />
    ) : null;

    return { pedir, Confirmacion };
}

export default function ConfirmDialog({
    open,
    titulo,
    mensaje,
    detalle,
    tono = 'oliva',
    confirmarTexto = 'Confirmar',
    cancelarTexto = 'Cancelar',
    procesando = false,
    onConfirmar,
    onCancelar,
}) {
    const t = TONOS[tono] ?? TONOS.oliva;

    return (
        <Modal open={open} onClose={procesando ? undefined : onCancelar} title={titulo} size="sm">
            <div className="flex items-start gap-3">
                <span
                    className="shrink-0 flex items-center justify-center w-9 h-9 rounded-xl"
                    style={{ background: t.wash, color: t.color }}
                    aria-hidden="true"
                >
                    <t.Icono size={17} strokeWidth={2.4} />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ofbol-ink)' }}>
                        {mensaje}
                    </p>
                    {detalle && (
                        <p className="ofbol-etiqueta mt-2" style={{ color: t.color }}>{detalle}</p>
                    )}
                </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
                <button
                    type="button"
                    onClick={onCancelar}
                    disabled={procesando}
                    className="ofbol-btn-ghost justify-center"
                >
                    {cancelarTexto}
                </button>
                <button
                    type="button"
                    onClick={onConfirmar}
                    disabled={procesando}
                    className={`${t.btn} justify-center`}
                >
                    {procesando ? 'Procesando…' : confirmarTexto}
                </button>
            </div>
        </Modal>
    );
}
