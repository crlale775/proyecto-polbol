/**
 * Trazabilidad.jsx — Recorrido del trámite · Comando Departamental de La Paz.
 *
 * Fiscalización de las 9 EPIs hacia el Comando General, con la identidad ámbar
 * del nivel de supervisión departamental.
 *
 * Antes esto eran ~770 líneas que armaban a mano el stepper y la bitácora con
 * colores genéricos. Todo el comportamiento vive ahora en
 * `RecorridoInstitucional`, compartido con el Comando General.
 */
import React from 'react';
import LayoutComandoDepartamental from '../../js/components/LayoutComandoDepartamental';
import RecorridoInstitucional from '../../js/components/ui/RecorridoInstitucional';
import { ACENTOS } from '../../js/components/ui/Panel';

export default function Trazabilidad() {
    return (
        <RecorridoInstitucional
            Layout={LayoutComandoDepartamental}
            acento={ACENTOS.ambar}
            titulo="Recorrido del trámite"
            detalle="Fiscalización cronológica de los memorándums que salen de las 9 EPIs de La Paz: emisión, visado departamental, retornos por observación y cierre en el Comando General."
        />
    );
}
