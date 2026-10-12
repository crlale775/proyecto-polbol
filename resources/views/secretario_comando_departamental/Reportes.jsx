/**
 * Reportes — Módulo de Reportes del Comando Departamental de La Paz.
 * Usa el motor unificado de reportes OFBOL con alcance departamental
 * (selector de EPI + rango de fechas).
 */
import React from 'react';
import ReportesEngine from '../repertorios/ui/ReportesEngine';

export default function Reportes() {
    return <ReportesEngine alcance="departamental" />;
}
