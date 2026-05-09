import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
        plugins: [react(), tailwindcss()],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, 'src'), 
            },
        },
        server: {
            port: 3000,
            proxy: {
                // Это правило перенаправляет все запросы с фронтенда на ваш C# бэкенд
                '/api': {
                    target: 'https://localhost:7276', // ВАШ ПОРТ ИЗ SWAGGER
                    secure: false, // Важно для локальных самоподписанных сертификатов https
                    changeOrigin: true
                }
            }
        },
    };
});