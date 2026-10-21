import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { SESSION_EXPIRED_EVENT, TOKEN_KEY } from '../services/api';
import { authApi } from '../services/laboratorio';
import type { RolNombre, UsuarioSesion } from '../types/api';

interface AuthContextValue {
  usuario: UsuarioSesion | null;
  /** true mientras se valida el token guardado al abrir la aplicación. */
  cargando: boolean;
  iniciarSesion: (username: string, password: string) => Promise<void>;
  cerrarSesion: () => void;
  tieneRol: (...roles: RolNombre[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [cargando, setCargando] = useState<boolean>(() => localStorage.getItem(TOKEN_KEY) !== null);

  const cerrarSesion = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUsuario(null);
  }, []);

  // Al abrir la app: si hay token guardado, se valida contra /auth/me.
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setCargando(false);
      return;
    }
    let vigente = true;
    authApi
      .perfil()
      .then((perfil) => {
        if (vigente) setUsuario(perfil);
      })
      .catch(() => {
        if (vigente) cerrarSesion();
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [cerrarSesion]);

  // El interceptor de Axios avisa cuando el API responde 401 con una sesión activa.
  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, cerrarSesion);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, cerrarSesion);
  }, [cerrarSesion]);

  const iniciarSesion = useCallback(async (username: string, password: string) => {
    const sesion = await authApi.login(username, password);
    localStorage.setItem(TOKEN_KEY, sesion.token);
    setUsuario(sesion.usuario);
  }, []);

  const tieneRol = useCallback(
    (...roles: RolNombre[]) => usuario !== null && roles.includes(usuario.rol),
    [usuario],
  );

  const valor = useMemo(
    () => ({ usuario, cargando, iniciarSesion, cerrarSesion, tieneRol }),
    [usuario, cargando, iniciarSesion, cerrarSesion, tieneRol],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return contexto;
}
