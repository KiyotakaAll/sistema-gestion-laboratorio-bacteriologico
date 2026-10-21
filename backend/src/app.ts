import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import routes from './routes';
import { asyncHandler } from './utils/http';

/**
 * Se separa la construcción de la app (aquí) del arranque del servidor
 * (server.ts) para poder importar `app` en pruebas sin abrir un puerto.
 */
const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN.split(',').map((origen) => origen.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(express.json({ limit: '1mb' }));

// Verifica proceso y conexión a MySQL; útil para monitoreo y para depurar el entorno.
app.get(
  '/api/health',
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  }),
);

app.use('/api', routes);

// Orden obligatorio: primero 404, al final el manejador de errores.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
