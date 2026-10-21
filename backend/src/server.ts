import app from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';

async function iniciar(): Promise<void> {
  // Falla rápido si MySQL no está disponible, en vez de descubrirlo en la primera petición.
  await prisma.$connect();

  const servidor = app.listen(env.PORT, () => {
    console.log(`API del laboratorio escuchando en http://localhost:${env.PORT}/api (${env.NODE_ENV})`);
  });

  // Cierre ordenado: deja de aceptar peticiones, termina las en curso y libera el pool de MySQL.
  const apagar = (senal: string): void => {
    console.log(`Señal ${senal} recibida, cerrando servidor...`);
    servidor.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', () => apagar('SIGINT'));
  process.on('SIGTERM', () => apagar('SIGTERM'));
}

iniciar().catch((error: unknown) => {
  console.error('No se pudo iniciar el servidor:', error);
  process.exit(1);
});
