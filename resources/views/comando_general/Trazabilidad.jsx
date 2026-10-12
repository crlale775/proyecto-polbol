/**
 * Trazabilidad.jsx — Recorrido del trámite · Comando General.
 *
 * El Comando General es la instancia máxima del flujo, así que esta pantalla
 * es la versión de cierre: el mismo recorrido con la identidad teal del nivel
 * nacional.
 *
 * Antes esto eran ~937 líneas que armaban a mano el stepper y la bitácora con
 * colores genéricos. Todo el comportamiento vive ahora en
 * `RecorridoInstitucional`, compartido con el Comando Departamental.
 */
import React from 'react';
import LayoutComandoGeneral from '../../js/components/LayoutComandoGeneral';
import RecorridoInstitucional from '../../js/components/ui/RecorridoInstitucional';
import { ACENTOS } from '../../js/components/ui/Panel';

export default function Trazabilidad() {
    return (
        <RecorridoInstitucional
            Layout={LayoutComandoGeneral}
            acento={ACENTOS.teal}
            titulo="Recorrido del trámite"
            detalle="Cadena de custodia institucional: quién emitió el memorándum, quién lo visó, cuándo retornó por observación y en qué momento quedó registrado en el escalafón."
        />
    );
}
