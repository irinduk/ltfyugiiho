import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ВАЖНО: Порт из вашего Visual Studio (обычно 7276 для HTTPS или 5000 для HTTP)
const CS_BACKEND_URL = 'https://localhost:7276';
const PORT = 3000;

async function startServer() {
    const app = express();

    // Логирование всех входящих запросов для удобства отладки
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
        next();
    });

    // ЕДИНСТВЕННЫЙ РОУТ ДЛЯ API: ПРОКСИ НА C# БЭКЕНД
    // Все запросы, начинающиеся с /api (включая авторизацию, смены, сотрудников), 
    // автоматически перенаправляются в ваш C# ASP.NET Core
    app.use('/api', createProxyMiddleware({
        target: CS_BACKEND_URL,
        changeOrigin: true,
        secure: false, // Игнорируем самоподписанные сертификаты localhost от .NET
        // Express убирает префикс /api для смонтированного middleware, вернем его обратно.
        pathRewrite: (path) => `/api${path}`,
        on: {
            error: (err, req, res) => {
                console.error('Proxy Error:', err.message);
                if (!res.headersSent) {
                    res.writeHead(502, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: 'C# бэкенд недоступен',
                        details: `Убедитесь, что Visual Studio запущена и проект активен на ${CS_BACKEND_URL}. Ошибка: ${err.message}`
                    }));
                }
            }
        }
    }));

    // Настройка Vite для отдачи фронтенда (React)
    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(__dirname, 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n🚀 NOC Control Terminal: http://localhost:${PORT}`);
        console.log(`🔗 API Tunnel (Proxy): requests -> ${CS_BACKEND_URL}\n`);
    });
}

startServer();