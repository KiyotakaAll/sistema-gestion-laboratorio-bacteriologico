import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  abierto: boolean;
  titulo: string;
  subtitulo?: ReactNode;
  onCerrar: () => void;
  ancho?: 'md' | 'lg' | 'xl';
  children: ReactNode;
  pie?: ReactNode;
}

const ANCHO = { md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-6xl' } as const;

/** Pila de modales abiertos: con modales anidados, Escape cierra solo el de arriba. */
const pila: string[] = [];

export function Modal({ abierto, titulo, subtitulo, onCerrar, ancho = 'lg', children, pie }: ModalProps) {
  const idTitulo = useId();
  const idModal = useId();
  const contenedor = useRef<HTMLDivElement>(null);
  // Ref para no reiniciar el efecto (y robar el foco) cuando el padre re-renderiza.
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;

  useEffect(() => {
    if (!abierto) return;
    pila.push(idModal);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    contenedor.current?.focus();

    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape' && pila[pila.length - 1] === idModal) {
        cerrar.current();
      }
    };
    window.addEventListener('keydown', alPresionar);

    return () => {
      window.removeEventListener('keydown', alPresionar);
      const posicion = pila.indexOf(idModal);
      if (posicion >= 0) pila.splice(posicion, 1);
      document.body.style.overflow = overflowPrevio;
    };
  }, [abierto, idModal]);

  if (!abierto) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex animate-aparecer items-start justify-center overflow-y-auto bg-violeta-950/50 p-8">
      <div className="fixed inset-0" onClick={() => onCerrar()} aria-hidden />
      <div
        ref={contenedor}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className={`relative flex max-h-[calc(100vh-4rem)] w-full flex-col rounded-md border border-slate-300 bg-white shadow-xl outline-none ${ANCHO[ancho]}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-3">
          <div className="min-w-0">
            <h2 id={idTitulo} className="font-serif text-lg font-semibold text-violeta-900">
              {titulo}
            </h2>
            {subtitulo && <div className="mt-0.5 text-sm text-slate-600">{subtitulo}</div>}
          </div>
          <button
            type="button"
            onClick={() => onCerrar()}
            className="rounded-sm p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {pie && <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">{pie}</footer>}
      </div>
    </div>,
    document.body,
  );
}
