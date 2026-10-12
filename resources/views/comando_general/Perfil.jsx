/**
 * Perfil.jsx — Perfil Institucional del Comando General de la Policía Boliviana.
 * La anatomía vive en `ui/PerfilInstitucional`; acá solo la identidad del rol.
 */
import React from 'react';
import LayoutComandoGeneral from '../../js/components/LayoutComandoGeneral';
import PerfilInstitucional from '../../js/components/ui/PerfilInstitucional';
import { useAuth } from '../../js/context/AuthContext';

export default function Perfil() {
    const { user } = useAuth();
    const inicial = (user?.usuario?.[0] ?? 'G').toUpperCase();

    return (
        <LayoutComandoGeneral>
            <div className="p-6 lg:p-8 max-w-4xl mx-auto ofbol-page-enter">
                <PerfilInstitucional
                    titulo="Perfil institucional"
                    nota="Credenciales y facultades de la instancia máxima del sistema."
                    acento="#8a9a6d"
                    nombreMostrado={user?.usuario ?? 'Comando General'}
                    correoMostrado={user?.correo ?? 'comando.general@policia.bo'}
                    rolMostrado={user?.rol ?? 'Comando General'}
                    insignias={[{ texto: 'Instancia máxima nacional', tono: 'oliva' }]}
                    avatar={
                        <span
                            className="w-16 h-16 rounded-[14px] flex items-center justify-center text-2xl font-black text-white"
                            style={{ background: 'var(--ofbol-olive)' }}
                            aria-hidden="true"
                        >
                            {inicial}
                        </span>
                    }
                    datos={[
                        { etiqueta: 'Usuario', valor: user?.usuario ?? '—' },
                        { etiqueta: 'Nivel institucional', valor: 'Dirección Nacional de Personal' },
                        { etiqueta: 'Facultad del rol', valor: 'Recepción, validación y registro final' },
                        { etiqueta: 'Acceso', valor: 'Nivel máximo' },
                    ]}
                />
            </div>
        </LayoutComandoGeneral>
    );
}
