/**
 * Reportes — Módulo de Reportes del Secretario de Unidad (EPI).
 * Usa el motor unificado de reportes OFBOL con alcance restringido a la
 * EPI del secretario (los datos ya vienen filtrados por el backend).
 */
import React from 'react';
import ReportesEngine from '../repertorios/ui/ReportesEngine';

export default function Reportes() {
    return <ReportesEngine alcance="unidad" />;
}
