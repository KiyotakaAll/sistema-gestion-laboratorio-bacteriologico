import { PrismaClient } from '@prisma/client';
import { env } from './env';

/**
 * Decisión de arquitectura: una única instancia de PrismaClient por proceso.
 * Cada instancia abre su propio pool de conexiones; crear una por controlador
 * o servicio agotaría las conexiones de MySQL. Se guarda en `globalThis` para
 * que el hot-reload de `tsx watch` en desarrollo no cree clientes duplicados.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
