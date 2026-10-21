import axios, { type AxiosError } from 'axios';
import type { ApiErrorBody } from '../types/api';

/**
 * Cliente Axios único. `baseURL: '/api'` es relativo: en desarrollo Vite hace
 * de proxy hacia el backend (ver vite.config.ts), así no hay CORS.
 *
 * El token JWT se guarda en localStorage por simplicidad académica. En un
 * sistema productivo convendría una cookie HttpOnly para mitigar robo por XSS.
 */
export const TOKEN_KEY = 'lab_token';
export const SESSION_EXPIRED_EVENT = 'lab:sesion-expirada';

export const api = axios.create({ baseURL: '/api', timeout: 15_000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (respuesta) => respuesta,
  (error: AxiosError<ApiErrorBody>) => {
    // Un 401 fuera del login significa token vencido o inválido: AuthContext cierra la sesión.
    const esLogin = (error.config?.url ?? '').includes('/auth/login');
    if (error.response?.status === 401 && !esLogin) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  },
);

export function mensajeDeError(error: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const mensaje = error.response?.data?.error?.message;
    if (mensaje) return mensaje;
    if (error.code === 'ECONNABORTED') return 'El servidor tardó demasiado en responder. Intente de nuevo.';
    if (!error.response) return 'No se pudo conectar con el servidor. Verifique que el backend esté en ejecución.';
  }
  return 'Ocurrió un error inesperado.';
}

export interface DetalleCampo {
  campo: string;
  mensaje: string;
}

/** Errores por campo que devuelve el backend cuando falla la validación Zod. */
export function detallesDeError(error: unknown): DetalleCampo[] {
  if (!axios.isAxiosError<ApiErrorBody>(error)) return [];
  const detalles = error.response?.data?.error?.details;
  if (!Array.isArray(detalles)) return [];
  return detalles.filter(
    (d): d is DetalleCampo =>
      typeof d === 'object' && d !== null && 'campo' in d && 'mensaje' in d,
  );
}
