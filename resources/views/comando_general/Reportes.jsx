/**
 * Reportes — Módulo de Reportes del Comando General de la Policía Boliviana.
 * Usa el motor unificado de reportes OFBOL con alcance nacional
 * (selector de EPI + rango de fechas).
 */
import React from 'react';
import ReportesEngine from '../repertorios/ui/ReportesEngine';

export default function Reportes() {
    return <ReportesEngine alcance="nacional" />;
}
