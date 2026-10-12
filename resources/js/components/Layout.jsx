import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Layout = ({ children }) => {
    const location = useLocation();

    const navSections = [
        {
            title: 'Secretario Unidad',
            basePath: '/secretario-unidad',
            links: [
                { path: '/secretario-unidad/dashboard', label: 'Dashboard' },
                { path: '/secretario-unidad/subir-documento', label: 'Subir Documento' },
                { path: '/secretario-unidad/mis-documentos', label: 'Mis Documentos' },
                { path: '/secretario-unidad/historial', label: 'Historial' },
                { path: '/secretario-unidad/notificaciones', label: 'Notificaciones' },
            ],
        },
        {
            title: 'Secretario Comando Departamental',
            basePath: '/comando-departamental',
            links: [
                { path: '/comando-departamental/dashboard', label: 'Dashboard' },
                { path: '/comando-departamental/revision', label: 'Revisión de Documentos' },
                { path: '/comando-departamental/observaciones', label: 'Observaciones' },
                { path: '/comando-departamental/historial', label: 'Historial' },
            ],
        },
        {
            title: 'Comando General',
            basePath: '/comando-general',
            links: [
                { path: '/comando-general/dashboard', label: 'Dashboard' },
                { path: '/comando-general/documentos', label: 'Documentos Aprobados' },
                { path: '/comando-general/historial', label: 'Historial' },
                { path: '/comando-general/reportes', label: 'Reportes' },
            ],
        },
    ];

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
            {/* Header */}
            <header className="bg-emerald-800 text-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <div className="bg-emerald-950 p-2 rounded-lg font-black text-xl tracking-wider text-amber-400 border border-emerald-700">
                            OFBOL
                        </div>
                        <div>
                            <h1 className="text-lg font-bold leading-tight">Policía Boliviana</h1>
                            <p className="text-xs text-emerald-200">Plataforma Inteligente de Gestión Administrativa Documental</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                        <span className="bg-emerald-900/80 px-3 py-1.5 rounded-md border border-emerald-700 font-medium text-emerald-100">
                            Estado: Conectado
                        </span>
                    </div>
                </div>
            </header>

            {/* Sub-navigation bar */}
            <nav className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-wrap gap-y-2 py-3 justify-between items-center">
                        {navSections.map((section) => (
                            <div key={section.title} className="flex flex-col space-y-1">
                                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                    {section.title}
                                </span>
                                <div className="flex flex-wrap gap-1">
                                    {section.links.map((link) => {
                                        const isActive = location.pathname === link.path;
                                        return (
                                            <Link
                                                key={link.path}
                                                to={link.path}
                                                className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                                                    isActive
                                                        ? 'bg-emerald-700 text-white shadow-sm'
                                                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                                }`}
                                            >
                                                {link.label}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[500px]">
                    {children}
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
                OFBOL © 2026 - Policía Boliviana | Sistema de Gestión Documental
            </footer>
        </div>
    );
};

export default Layout;
