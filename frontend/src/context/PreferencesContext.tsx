import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Tema = 'claro' | 'oscuro' | 'sistema';
export interface Preferencias {
  tema: Tema;
  densidad: 'comoda' | 'compacta';
  reducirMovimiento: boolean;
  avisosInformativos: boolean;
}
export const PREFERENCES_KEY = 'labzen_preferences_v1';
export const PREDETERMINADAS: Preferencias = {
  tema: 'sistema', densidad: 'comoda', reducirMovimiento: false, avisosInformativos: true,
};

function leer(): Preferencias {
  try {
    const valor = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}');
    return {
      tema: ['claro', 'oscuro', 'sistema'].includes(valor?.tema) ? valor.tema : 'sistema',
      densidad: valor?.densidad === 'compacta' ? 'compacta' : 'comoda',
      reducirMovimiento: valor?.reducirMovimiento === true,
      avisosInformativos: valor?.avisosInformativos !== false,
    };
  } catch { return { ...PREDETERMINADAS }; }
}

interface PreferencesApi {
  preferencias: Preferencias;
  actualizar: (cambio: Partial<Preferencias>) => void;
  restablecer: () => void;
}
const PreferencesContext = createContext<PreferencesApi>({
  preferencias: PREDETERMINADAS, actualizar: () => {}, restablecer: () => {},
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferencias, setPreferencias] = useState(leer);
  useEffect(() => {
    const sistema = window.matchMedia?.('(prefers-color-scheme: dark)');
    const aplicar = () => {
      document.documentElement.dataset.tema = preferencias.tema === 'sistema'
        ? (sistema?.matches ? 'oscuro' : 'claro') : preferencias.tema;
      document.documentElement.dataset.densidad = preferencias.densidad;
      document.documentElement.dataset.movimiento = preferencias.reducirMovimiento ? 'reducido' : 'sistema';
    };
    aplicar();
    sistema?.addEventListener('change', aplicar);
    try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferencias)); } catch { /* Memoria si el navegador bloquea el almacenamiento. */ }
    return () => sistema?.removeEventListener('change', aplicar);
  }, [preferencias]);

  useEffect(() => {
    const sincronizar = (e: StorageEvent) => {
      if (e.key === PREFERENCES_KEY || e.key === null) setPreferencias(leer());
    };
    window.addEventListener('storage', sincronizar);
    return () => window.removeEventListener('storage', sincronizar);
  }, []);

  const valor = useMemo(() => ({
    preferencias,
    actualizar: (cambio: Partial<Preferencias>) => setPreferencias((p) => ({ ...p, ...cambio })),
    restablecer: () => setPreferencias({ ...PREDETERMINADAS }),
  }), [preferencias]);
  return <PreferencesContext.Provider value={valor}>{children}</PreferencesContext.Provider>;
}

export const usePreferences = () => useContext(PreferencesContext);
