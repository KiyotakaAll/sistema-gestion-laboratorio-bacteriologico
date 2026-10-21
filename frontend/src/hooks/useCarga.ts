import { useCallback, useEffect, useState, type DependencyList } from 'react';
import { mensajeDeError } from '../services/api';

/**
 * Carga asíncrona con estado de carga/error. Se vuelve a ejecutar cuando
 * cambia alguna dependencia o al llamar `recargar()`. Ignora respuestas de
 * peticiones obsoletas (si el filtro cambió mientras la anterior volaba).
 */
export function useCarga<T>(cargar: () => Promise<T>, dependencias: DependencyList) {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);

    cargar()
      .then((resultado) => {
        if (vigente) setDatos(resultado);
      })
      .catch((e: unknown) => {
        if (vigente) setError(mensajeDeError(e));
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
    // `cargar` se redefine en cada render; la lista de dependencias la controla quien llama.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencias, version]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  return { datos, cargando, error, recargar };
}
