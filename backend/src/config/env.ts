import 'dotenv/config';
import { z } from 'zod';

/**
 * Decisión de arquitectura: las variables de entorno se validan UNA sola vez al
 * arrancar (fail-fast). Si falta algo crítico (p. ej. JWT_SECRET) el proceso
 * termina con un mensaje claro en vez de fallar tarde, en medio de una petición.
 * El resto del código importa `env` ya tipado y nunca toca `process.env`.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z
    .string()
    .startsWith('mysql://', 'DATABASE_URL debe empezar con mysql://'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  // Se expresa en segundos (número) para evitar problemas de tipado de `expiresIn`.
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 8),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const detalle = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    console.error(`Variables de entorno inválidas:\n${detalle}`);
    process.exit(1);
  }
  return parsed.data;
}

export const env: Env = loadEnv();
