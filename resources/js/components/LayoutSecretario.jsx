/**
 * LayoutSecretario — Shell institucional estilo PolBol
 * 
 * Diseño original: Sidebar con identidad militar institucional
 * Corregido: Tamaño del escudo, compacidad del sidebar
 */
import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Escudo from './ui/Escudo';
import AvatarFoto from './ui/AvatarFoto';
import { prefetchRuta, prefetchEnOcioso } from '../lib/prefetch';
import { Home, UploadCloud, FolderOpen, PencilLine, Users, History, FileText, BarChart3, Bell, UserCircle, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

const NAV_ITEMS = [
    { path: '/secretario/dashboard', label: 'Inicio', icon: Home },
    { path: '/secretario/subir-documento', label: 'Subir Documento', icon: UploadCloud, accent: true },
    { path: '/secretario/mis-documentos', label: 'Mis Documentos', icon: FolderOpen },
    { path: '/secretario/correcciones', label: 'Correcciones', icon: PencilLine },
    { path: '/secretario/oficiales', label: 'Personal de la EPI', icon: Users },
    { path: '/secretario/historial', label: 'Historial', icon: History },
    { path: '/secretario/plantillas', label: 'Plantillas Oficiales', icon: FileText },
    { path: '/secretario/reportes', label: 'Reportes', icon: BarChart3 },
    { path: '/secretario/notificaciones', label: 'Notificaciones', icon: Bell, badge: true },
    { path: '/secretario/perfil', label: 'Mi Perfil', icon: UserCircle },
];

export default function LayoutSecretario({ children, notifCount = 0 }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    // Velocidad percibida: precarga de los módulos más usados en tiempo ocioso.
    useEffect(() => {
        prefetchEnOcioso(NAV_ITEMS.slice(0, 5).map((i) => i.path));
    }, []);

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: '#f8f7f4', fontFamily: 'var(--font-sans)' }}>
            {/* ═══ SIDEBAR ═══ */}
            <aside
                className="flex-shrink-0 flex flex-col z-20"
                style={{
                    width: sidebarOpen ? '240px' : '64px',
                    transition: 'width 280ms cubic-bezier(0.16, 1, 0.3, 1)',
                    background: '#0f1613',
                    borderRight: '1px solid rgba(255,255,255,0.06)',
                }}
            >
                {/* Logo — compacto */}
                <div
                    className="flex items-center shrink-0"
                    style={{
                        height: '56px',
                        padding: sidebarOpen ? '0 16px' : '0',
                        justifyContent: sidebarOpen ? 'flex-start' : 'center',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        gap: '10px',
                    }}
                >
                    <Escudo className="w-8 h-8 shrink-0" />
                    {sidebarOpen && (
                        <div className="min-w-0">
                            <p style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                color: 'rgba(255,255,255,0.9)',
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                lineHeight: '1.2',
                            }}>
                                Policía Boliviana
                            </p>
                            <p style={{
                                fontSize: '8px',
                                fontWeight: 600,
                                color: '#8a9a6d',
                                letterSpacing: '0.15em',
                                textTransform: 'uppercase',
                                marginTop: '1px',
                            }}>
                                Secretaría EPI
                            </p>
                        </div>
                    )}
                </div>

                {/* User card — compacto */}
                {sidebarOpen && user && (
                    <div style={{ padding: '12px 12px 0' }} className="shrink-0">
                        <div
                            className="flex items-center"
                            style={{
                                padding: '10px',
                                borderRadius: '9px',
                                background: 'rgba(74, 90, 53, 0.18)',
                                border: '1px solid rgba(138, 154, 109, 0.28)',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                                gap: '10px',
                            }}
                        >
                            <AvatarFoto
                                foto={user?.foto}
                                nombre={user?.usuario}
                                iniciales={user?.usuario?.[0]?.toUpperCase() ?? 'S'}
                                className="w-8 h-8 rounded-lg text-[12px]"
                                fallbackClassName="bg-gradient-to-b from-[#5a6b3d] to-[#3d4a2c]"
                            />
                            <div className="min-w-0">
                                <p style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    color: 'white',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.02em',
                                    lineHeight: '1.2',
                                }}>
                                    {user?.usuario ?? 'Secretario'}
                                </p>
                                <p style={{
                                    fontSize: '9px',
                                    fontWeight: 600,
                                    color: '#8a9a6d',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.06em',
                                    marginTop: '1px',
                                }}>
                                    {user?.rol ?? 'Secretario EPI'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Navigation — compacto */}
                <div className="flex-1 overflow-y-auto" style={{ padding: sidebarOpen ? '16px 8px' : '16px 6px' }}>
                    {sidebarOpen && (
                        <p style={{
                            fontSize: '8px',
                            fontWeight: 800,
                            color: 'rgba(255,255,255,0.25)',
                            letterSpacing: '0.18em',
                            textTransform: 'uppercase',
                            marginBottom: '6px',
                            paddingLeft: '8px',
                        }}>
                            Módulos
                        </p>
                    )}
                    <nav className="space-y-0.5">
                        {NAV_ITEMS.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) => `ofbol-nav-link flex items-center ${isActive ? 'ofbol-nav-link--activa' : ''}`}
                                style={{
                                    gap: sidebarOpen ? '8px' : '0',
                                    padding: sidebarOpen ? '8px 10px' : '8px 0',
                                    justifyContent: sidebarOpen ? 'flex-start' : 'center',
                                }}
                                title={!sidebarOpen ? item.label : undefined}
                                onMouseEnter={() => prefetchRuta(item.path)}
                                onFocus={() => prefetchRuta(item.path)}
                            >
                                {({ isActive }) => (
                                    <>
                                        <span className="shrink-0" style={{ display: 'flex', alignItems: 'center' }}>
                                            <item.icon size={16} strokeWidth={1.8} />
                                        </span>
                                        {sidebarOpen && <span className="flex-1 truncate">{item.label}</span>}
                                        {sidebarOpen && item.badge && notifCount > 0 && (
                                            <span
                                                className="ml-auto shrink-0 flex items-center justify-center tabular-nums"
                                                style={{
                                                    minWidth: '16px',
                                                    height: '16px',
                                                    padding: '0 4px',
                                                    fontSize: '8px',
                                                    fontWeight: 900,
                                                    background: '#8f2020',
                                                    color: 'white',
                                                    borderRadius: '4px',
                                                }}
                                            >
                                                {notifCount > 9 ? '9+' : notifCount}
                                            </span>
                                        )}
                                        {sidebarOpen && (
                                            <span
                                                className="ofbol-nav-dot shrink-0"
                                                style={{ opacity: isActive ? 1 : 0, background: '#8a9a6d' }}
                                            />
                                        )}
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </nav>
                </div>

                {/* EPI info — compacto */}
                {sidebarOpen && user && (
                    <div style={{ padding: '0 12px 10px' }} className="shrink-0">
                        <div
                            style={{
                                padding: '9px 11px',
                                borderRadius: '9px',
                                background: 'rgba(138, 154, 109, 0.07)',
                                border: '1px solid rgba(138, 154, 109, 0.16)',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                            }}
                        >
                            <p style={{
                                fontSize: '7px',
                                fontWeight: 800,
                                color: '#8a9a6d',
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                marginBottom: '2px',
                            }}>
                                EPI Asignada
                            </p>
                            <p style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                color: 'rgba(255,255,255,0.75)',
                                lineHeight: '1.3',
                            }}>
                                {user.epi ?? '—'}
                            </p>
                        </div>
                    </div>
                )}

                {/* Toggle button */}
                <div style={{ padding: '0 8px 8px' }} className="shrink-0">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="w-full flex items-center justify-center transition-colors"
                        style={{
                            height: '28px',
                            borderRadius: '5px',
                            color: 'rgba(255,255,255,0.3)',
                            background: 'rgba(255,255,255,0.03)',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                            e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'rgba(255,255,255,0.3)';
                            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                        }}
                        aria-label={sidebarOpen ? 'Contraer sidebar' : 'Expandir sidebar'}
                        aria-expanded={sidebarOpen}
                    >
                        {sidebarOpen
                            ? <PanelLeftClose size={13} />
                            : <PanelLeftOpen size={13} />}
                    </button>
                </div>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    className="flex items-center shrink-0 transition-colors"
                    style={{
                        gap: '8px',
                        padding: sidebarOpen ? '12px 16px' : '12px 0',
                        justifyContent: sidebarOpen ? 'flex-start' : 'center',
                        borderTop: '1px solid rgba(255,255,255,0.04)',
                        fontSize: '9px',
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'rgba(255,100,100,0.5)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'rgba(255,100,100,0.9)';
                        e.currentTarget.style.background = 'rgba(255,50,50,0.05)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'rgba(255,100,100,0.5)';
                        e.currentTarget.style.background = 'transparent';
                    }}
                    aria-label="Cerrar sesión"
                >
                    <LogOut size={14} className="shrink-0" />
                    {sidebarOpen && <span>Cerrar Sesión</span>}
                </button>
            </aside>

            {/* ═══ MAIN ═══ */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* TOPBAR — limpio y compacto */}
                <header
                    className="flex items-center shrink-0"
                    style={{
                        height: '52px',
                        background: 'rgba(255, 255, 255, 0.9)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        borderBottom: '1px solid #e8e6e1',
                        boxShadow: '0 1px 3px rgba(10, 15, 13, 0.04)',
                        padding: '0 24px',
                        gap: '12px',
                        position: 'relative',
                        zIndex: 10,
                    }}
                >
                    <div className="min-w-0">
                        <div className="flex items-center" style={{ gap: '6px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#5a615f' }}>
                                Secretaría de Unidad
                            </span>
                            <span style={{ fontSize: '9px', color: '#d1cec8' }}>/</span>
                            <span style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#0a0f0d',
                                textTransform: 'uppercase',
                            }}>
                                {user?.epi || 'EPI Policial'}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center ml-auto" style={{ gap: '8px' }}>
                        {/* Notifications */}
                        <NavLink
                            to="/secretario/notificaciones"
                            className="relative flex items-center justify-center transition-colors"
                            style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                color: '#5a615f',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#f0efec';
                                e.currentTarget.style.color = '#3f4849';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = '#5a615f';
                            }}
                            aria-label={`Notificaciones${notifCount > 0 ? ` (${notifCount} sin leer)` : ''}`}
                        >
                            <Bell size={16} strokeWidth={1.8} />
                            {notifCount > 0 && (
                                <span
                                    className="absolute"
                                    style={{
                                        top: '5px',
                                        right: '5px',
                                        width: '7px',
                                        height: '7px',
                                        borderRadius: '50%',
                                        background: '#8f2020',
                                    }}
                                />
                            )}
                        </NavLink>

                        {/* Divider */}
                        <div style={{ width: '1px', height: '20px', background: '#e8e6e1' }} />

                        {/* User */}
                        <div className="flex items-center" style={{ gap: '8px' }}>
                            <AvatarFoto
                                foto={user?.foto}
                                nombre={user?.usuario}
                                iniciales={user?.usuario?.[0]?.toUpperCase() ?? 'S'}
                                className="w-7 h-7 rounded-md text-[11px]"
                                fallbackClassName="bg-[#3d4a2c]"
                            />
                            <div className="hidden sm:block text-left">
                                <p style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    color: '#0a0f0d',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.02em',
                                    lineHeight: '1.2',
                                }}>
                                    {user?.usuario ?? 'Secretario'}
                                </p>
                                <p style={{
                                    fontSize: '9px',
                                    fontWeight: 600,
                                    color: '#3d4a2c',
                                    letterSpacing: '0.04em',
                                }}>
                                    {user?.rol ?? 'Secretario EPI'}
                                </p>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="flex items-center justify-center rounded transition-colors"
                                style={{
                                    width: '28px',
                                    height: '28px',
                                    marginLeft: '4px',
                                    color: '#a8a5a0',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.color = '#8f2020';
                                    e.currentTarget.style.background = 'rgba(143,32,32, 0.06)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.color = '#a8a5a0';
                                    e.currentTarget.style.background = 'transparent';
                                }}
                                aria-label="Cerrar sesión"
                            >
                                <LogOut size={13} />
                            </button>
                        </div>
                    </div>
                </header>

                {/* Content */}
                <main
                    className="flex-1 overflow-y-auto"
                    style={{
                        background: '#f8f7f4',
                    }}
                >
                    {children}
                </main>
            </div>
        </div>
    );
}
