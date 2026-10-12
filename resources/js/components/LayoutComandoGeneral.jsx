/**
 * LayoutComandoGeneral — Shell institucional OFBOL del Comando General de la
 * Policía Boliviana. Usa el caparazón compartido (SidebarShell) con acento
 * oliva institucional y sus módulos propios.
 */
import React from 'react';
import {
    Home, Inbox, FileText, History, GitBranch, TrendingUp,
    BookOpen, UserPlus, Users, ScrollText, BarChart3, Bell, UserCircle, Layers,
} from 'lucide-react';
import SidebarShell from './SidebarShell';

const NAV_ITEMS = [
    { path: '/comando-general/dashboard', label: 'Inicio', icono: Home },
    { path: '/comando-general/documentos', label: 'Bandeja de Entrada', icono: Inbox, badge: 'pendientes' },
    { path: '/comando-general/registro', label: 'Registro Documental', icono: FileText },
    { path: '/comando-general/tipos-memo', label: 'Tipos de Memorándum', icono: Layers },
    { path: '/comando-general/historial', label: 'Historial General', icono: History },
    { path: '/comando-general/trazabilidad', label: 'Recorrido del Trámite', icono: GitBranch },
    { path: '/comando-general/comparativo', label: 'Desempeño de EPIs', icono: TrendingUp },
    { path: '/comando-general/directorio', label: 'Directorio Policial', icono: BookOpen },
    { path: '/comando-general/registro-oficiales', label: 'Registro Oficiales · IA', icono: UserPlus },
    { path: '/comando-general/usuarios', label: 'Gestión de Usuarios', icono: Users },
    { path: '/comando-general/auditoria', label: 'Registro de Actividad', icono: ScrollText },
    { path: '/comando-general/reportes', label: 'Reportes y Cifras', icono: BarChart3 },
    { path: '/comando-general/notificaciones', label: 'Notificaciones', icono: Bell, badge: 'notif' },
    { path: '/comando-general/perfil', label: 'Mi Perfil', icono: UserCircle },
];

export default function LayoutComandoGeneral({ children }) {
    return (
        <SidebarShell
            navItems={NAV_ITEMS}
            nombreRol="Comando General"
            subtituloRol="Comando General"
            acento="#8a9a6d"
            acentoSuave="rgba(138, 154, 109, 0.28)"
            badgeInferior={{ clave: 'general', etiqueta: 'Jurisdicción', valor: 'Dirección de Personal' }}
        >
            {children}
        </SidebarShell>
    );
}
