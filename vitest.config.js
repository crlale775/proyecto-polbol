import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Arnés de pruebas de las vistas React de OFBOL.
 *
 * Se configura aparte de `vite.config.js` a propósito: acá no entra el plugin
 * de Tailwind (las pruebas no evalúan estilos) y así el arranque es más corto.
 */
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: { '@': '/resources/js' },
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./tests/js/setup.js'],
        include: ['tests/js/**/*.test.{js,jsx}'],
        restoreMocks: true,
        clearMocks: true,
    },
});
