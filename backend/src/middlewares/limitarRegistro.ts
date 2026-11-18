import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/errors';

// Límite por proceso. Un despliegue con réplicas requiere un límite compartido en el proxy.
const intentos = new Map<string, { cantidad: number; vence: number }>();
export function limitarRegistro(req: Request, res: Response, next: NextFunction): void {
  const ahora = Date.now();
  for (const [ip, intento] of intentos) if (intento.vence <= ahora) intentos.delete(ip);
  const ip = req.ip ?? 'desconocida';
  const intento = intentos.get(ip) ?? { cantidad: 0, vence: ahora + 15 * 60_000 };
  if (intento.cantidad >= 5 || (!intentos.has(ip) && intentos.size >= 10_000)) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((intento.vence - ahora) / 1000))));
    next(new AppError(429, 'Demasiados intentos. Intente más tarde.', 'LIMITE_REGISTRO'));
    return;
  }
  intento.cantidad += 1;
  intentos.set(ip, intento);
  next();
}
