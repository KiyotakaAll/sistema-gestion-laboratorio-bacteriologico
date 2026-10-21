import type { AuthenticatedUser } from './auth';

/**
 * Extiende la interfaz Request de Express para que `req.user` esté tipado en
 * todo el proyecto sin castings. Lo rellena el middleware `authenticate`.
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
