/**
 * Perfil — Perfil Institucional del Revisor del Comando Departamental de La Paz.
 * La anatomía vive en `ui/PerfilInstitucional`; acá solo la identidad del rol y
 * la nota de competencia operativa.
 */
import React from 'react';
import LayoutComandoDepartamental from '../../js/components/LayoutComandoDepartamental';
import PerfilInstitucional from '../../js/components/ui/PerfilInstitucional';
import { useAuth } from '../../js/context/AuthContext';

export default function Perfil() {
    const { user } = useAuth();
    const inicial = (user?.usuario?.[0] ?? 'R').toUpperCase();

    return (
        <LayoutComandoDepartamental>
            <div className="p-6 lg:p-8 max-w-4xl mx-auto ofbol-page-enter">
                <PerfilInstitucional
                    titulo="Perfil institucional del revisor"
                    nota="Control previo de la documentación de las 9 EPIs de La Paz."
                    acento="#9a6f0a"
                    nombreMostrado={user?.usuario ?? 'Revisor Departamental'}
                    correoMostrado={user?.correo ?? 'revisor.lapaz@policia.bo'}
                    rolMostrado={user?.rol ?? 'Comando Departamental'}
                    insignias={[
                        { texto: 'Jurisdicción: 9 EPIs · La Paz', tono: 'papel' },
                        { texto: 'Habilitado para revisión', tono: 'teal' },
                    ]}
                    avatar={
                        <span
                            className="w-16 h-16 rounded-[14px] flex items-center justify-center text-2xl font-black text-white"
                            style={{ background: 'var(--ofbol-amber)' }}
                            aria-hidden="true"
                        >
                            {inicial}
                        </span>
                    }
                    datos={[
                        { etiqueta: 'Usuario', valor: user?.usuario ?? '—' },
                        { etiqueta: 'Nivel institucional', valor: 'Comando Departamental de Policía La Paz' },
                        { etiqueta: 'Facultad en el sistema', valor: 'Dictamen: aprobar al C.G. u observar a la EPI' },
                        { etiqueta: 'Credenciales', valor: 'Habilitado para revisión' },
                    ]}
                >
                    <section className="ofbol-card p-5">
                        <h2 className="ofbol-titulo-seccion">Competencia operativa</h2>
                        <p className="ofbol-nota mt-2">
                            El Comando Departamental es el órgano de control previo: verifica autenticidad,
                            legibilidad y legalidad formal de toda la documentación generada por el personal de las
                            9 EPIs antes de su remisión definitiva al Comando General de la Policía Boliviana.
                        </p>
                    </section>
                </PerfilInstitucional>
            </div>
        </LayoutComandoDepartamental>
    );
}
