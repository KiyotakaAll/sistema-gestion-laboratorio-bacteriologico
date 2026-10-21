import { useEffect, useState } from 'react';

/** Retrasa la propagación de un valor para no consultar al API en cada tecla. */
export function useDebounce<T>(valor: T, esperaMs = 300): T {
  const [valorRetrasado, setValorRetrasado] = useState(valor);

  useEffect(() => {
    const temporizador = window.setTimeout(() => setValorRetrasado(valor), esperaMs);
    return () => window.clearTimeout(temporizador);
  }, [valor, esperaMs]);

  return valorRetrasado;
}
