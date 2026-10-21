import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

type Tipo = 'exito' | 'error' | 'info';

interface Aviso {
  id: number;
  tipo: Tipo;
  mensaje: string;
}

interface ToastApi {
  exito: (mensaje: string) => void;
  error: (mensaje: string) => void;
  info: (mensaje: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ESTILO: Record<Tipo, string> = {
  exito: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  error: 'border-rose-300 bg-rose-50 text-rose-900',
  info: 'border-sky-300 bg-sky-50 text-sky-900',
};

const ICONO = { exito: CheckCircle2, error: XCircle, info: Info } as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const contador = useRef(0);

  const publicar = useCallback((tipo: Tipo, mensaje: string) => {
    contador.current += 1;
    const id = contador.current;
    setAvisos((actuales) => [...actuales, { id, tipo, mensaje }]);
    // Los errores permanecen más tiempo: el usuario necesita leerlos con calma.
    window.setTimeout(
      () => setAvisos((actuales) => actuales.filter((a) => a.id !== id)),
      tipo === 'error' ? 8000 : 4500,
    );
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      exito: (m) => publicar('exito', m),
      error: (m) => publicar('error', m),
      info: (m) => publicar('info', m),
    }),
    [publicar],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-96 flex-col gap-2" role="status" aria-live="polite">
        {avisos.map((aviso) => {
          const Icono = ICONO[aviso.tipo];
          return (
            <div
              key={aviso.id}
              className={`pointer-events-auto flex animate-aparecer items-start gap-2 rounded border px-3 py-2 text-sm shadow-sm ${ESTILO[aviso.tipo]}`}
            >
              <Icono className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{aviso.mensaje}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const contexto = useContext(ToastContext);
  if (!contexto) {
    throw new Error('useToast debe usarse dentro de <ToastProvider>');
  }
  return contexto;
}
