/**
 * Contexto de autenticación OFBOL.
 * Guarda el usuario activo en sessionStorage (o localStorage si marcó
 * "Recordar sesión") y reacciona a la expiración de la sesión PHP
 * (evento 'ofbol:sesion-expirada' emitido por lib/api.js).
 */
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

const AuthContext = createContext(null);

const STORAGE_KEY = 'ofbol_user';
const HORA_KEY = 'ofbol_session_hora';

function leerSesion() {
    try {
        const stored = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(leerSesion);

    const login = useCallback((userData, recordar = false) => {
        const destino = recordar ? localStorage : sessionStorage;
        const otro = recordar ? sessionStorage : localStorage;
        try {
            otro.removeItem(STORAGE_KEY);
            destino.setItem(STORAGE_KEY, JSON.stringify(userData));
            localStorage.setItem(HORA_KEY, String(Date.now()));
        } catch {
            /* almacenamiento no disponible */
        }
        setUser(userData);
    }, []);

    const logout = useCallback(() => {
        try {
            sessionStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(HORA_KEY);
        } catch {
            /* noop */
        }
        setUser(null);
    }, []);

    // Si la sesión PHP del servidor expira (respuesta 401 en cualquier
    // petición), cerramos la sesión local y dejamos que api.js redirija.
    useEffect(() => {
        const onExpirada = () => setUser(null);
        window.addEventListener('ofbol:sesion-expirada', onExpirada);
        return () => window.removeEventListener('ofbol:sesion-expirada', onExpirada);
    }, []);

    const value = useMemo(
        () => ({ user, login, logout, isAuthenticated: !!user }),
        [user, login, logout]
    );

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
    return ctx;
}
