/**
 * LayoutComandoDepartamental — Shell institucional OFBOL del Comando
 * Departamental de La Paz. Usa el caparazón compartido (SidebarShell) con
 * acento ámbar institucional y sus módulos propios.
 */
import React from 'react';
import {
    Home, ClipboardCheck, AlertTriangle, History, GitBranch,
    FolderOpen, TrendingUp, Users, BarChart3, Bell, UserCircle,
} from 'lucide-react';
import SidebarShell from './SidebarShell';

const NAV_ITEMS = [
    { path: '/comando-departamental/dashboard', label: 'Inicio', icono: Home },
    { path: '/comando-departamental/revision', label: 'Cola de Revisión', icono: ClipboardCheck, badge: 'pendientes' },
    { path: '/comando-departamental/observaciones', label: 'Observaciones', icono: AlertTriangle },
    { path: '/comando-departamental/historial', label: 'Historial', icono: History },
    { path: '/comando-departamental/trazabilidad', label: 'Recorrido del Trámite', icono: GitBranch },
    { path: '/comando-departamental/documentos-epi', label: 'Documentos por EPI', icono: FolderOpen },
    { path: '/comando-departamental/desempenio', label: 'Desempeño y Estadísticas', icono: TrendingUp },
    { path: '/comando-departamental/secretarios', label: 'Gestión Secretarios EPI', icono: Users },
    { path: '/comando-departamental/reportes', label: 'Reportes y Cifras', icono: BarChart3 },
    { path: '/comando-departamental/notificaciones', label: 'Notificaciones', icono: Bell, badge: 'notif' },
    { path: '/comando-departamental/perfil', label: 'Mi Perfil', icono: UserCircle },
];

export default function LayoutComandoDepartamental({ children }) {
    return (
        <SidebarShell
            navItems={NAV_ITEMS}
            nombreRol="Comando Departamental"
            subtituloRol="Comando Departamental"
            acento="#9a6f0a"
            acentoSuave="rgba(154, 111, 10, 0.28)"
            badgeInferior={{ clave: 'departamental', etiqueta: 'Jurisdicción', valor: 'Comando Dptal. La Paz (9 EPIs)' }}
        >
            {children}
        </SidebarShell>
    );
}
