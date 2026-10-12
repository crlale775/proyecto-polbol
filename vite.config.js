import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    resolve: {
        alias: {
            '@': '/resources/js',
        },
    },
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.jsx'],
            refresh: true,
        }),
        react(),
        tailwindcss(),
    ],
    build: {
        rollupOptions: {
            output: {
                // Vendors estables en chunks propios: se cachean entre releases
                // y la entrada de la app se mantiene pequeña → primer render más rápido.
                manualChunks: {
                    react: ['react', 'react-dom', 'react-router-dom'],
                    lucide: ['lucide-react'],
                },
            },
        },
    },
    server: {
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});
