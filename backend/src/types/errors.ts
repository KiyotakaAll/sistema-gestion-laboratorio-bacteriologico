/**
 * Error controlado de la aplicación. Los servicios lanzan `AppError` para
 * señalar reglas de negocio violadas (p. ej. "la muestra ya fue receptada");
 * el middleware `errorHandler` lo traduce a una respuesta HTTP uniforme.
 * Así los servicios no dependen de Express ni conocen objetos Response.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, code = 'ERROR_APLICACION', details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
