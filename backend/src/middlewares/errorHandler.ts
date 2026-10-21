import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { AppError } from '../types/errors';

/**
 * Formato único de error para todo el API:
 * { error: { code, message, details? } }
 * El frontend (Axios interceptor) solo necesita entender esta forma.
 */
interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

function send(res: Response, status: number, code: string, message: string, details?: unknown): void {
  const body: ErrorBody = { error: { code, message, ...(details !== undefined ? { details } : {}) } };
  res.status(status).json(body);
}

/** Convierte rutas inexistentes en un AppError 404 que pasa por errorHandler. */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`, 'RUTA_NO_ENCONTRADA'));
}

/** Traduce errores conocidos de Prisma (códigos Pxxxx) a respuestas HTTP semánticas. */
function handlePrismaKnownError(err: Prisma.PrismaClientKnownRequestError, res: Response): void {
  switch (err.code) {
    case 'P2002': {
      const target = (err.meta?.target as string | string[] | undefined) ?? 'campo único';
      send(res, 409, 'REGISTRO_DUPLICADO', 'Ya existe un registro con ese valor único.', { target });
      return;
    }
    case 'P2003':
      send(res, 409, 'REFERENCIA_INVALIDA', 'La operación viola una relación con otro registro.');
      return;
    case 'P2025':
      send(res, 404, 'REGISTRO_NO_ENCONTRADO', 'El registro solicitado no existe.');
      return;
    case 'P2034':
      send(res, 409, 'CONFLICTO_TRANSACCION', 'Conflicto de concurrencia, reintente la operación.');
      return;
    default:
      send(res, 500, 'ERROR_BASE_DATOS', 'Error al operar con la base de datos.', 
        env.NODE_ENV === 'development' ? { prismaCode: err.code } : undefined);
  }
}

/**
 * Middleware de errores (4 parámetros: Express lo reconoce por su aridad).
 * Debe registrarse al final de la cadena, después de todas las rutas.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    send(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      campo: issue.path.join('.'),
      mensaje: issue.message,
    }));
    send(res, 400, 'VALIDACION_FALLIDA', 'Los datos enviados no son válidos.', details);
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    handlePrismaKnownError(err, res);
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    send(res, 400, 'CONSULTA_INVALIDA', 'La consulta contiene datos con formato inválido.');
    return;
  }

  // express.json() lanza SyntaxError cuando el cuerpo no es JSON válido.
  if (err instanceof SyntaxError && 'body' in err) {
    send(res, 400, 'JSON_INVALIDO', 'El cuerpo de la petición no es un JSON válido.');
    return;
  }

  console.error('[ERROR NO CONTROLADO]', err);
  send(
    res,
    500,
    'ERROR_INTERNO',
    'Error interno del servidor.',
    env.NODE_ENV === 'development' && err instanceof Error ? { stack: err.stack } : undefined,
  );
}
