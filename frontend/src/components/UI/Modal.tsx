
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

const ANCHO = {
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
} as const;

/**
 * Pila de modales abiertos:
 * Escape cierra únicamente el modal superior.
 */
const pila: string[] = [];

export function Modal({
  abierto,
  titulo,
  subtitulo,
  onCerrar,
  ancho = 'lg',
  children,
  pie,
}: ModalProps) {
  const idTitulo = useId();
  const idModal = useId();
  const contenedor = useRef<HTMLDivElement>(null);

  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;

  useEffect(() => {
    if (!abierto) return;

    pila.push(idModal);

    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    contenedor.current?.focus();

    const alPresionar = (evento: KeyboardEvent) => {
      if (
        evento.key === 'Escape' &&
        pila[pila.length - 1] === idModal
      ) {
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
    <div className="fixed inset-0 z-50 flex animate-aparecer items-start justify-center overflow-y-auto bg-[#241833]/55 px-4 py-6 backdrop-blur-[2px] sm:px-6 sm:py-8">

      <div
        className="fixed inset-0"
        onClick={() => onCerrar()}
        aria-hidden
      />

      <div
        ref={contenedor}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className={`relative flex max-h-[calc(100vh-3rem)] w-full flex-col overflow-hidden rounded-2xl border border-[#e3e7ed] bg-white shadow-2xl outline-none sm:max-h-[calc(100vh-4rem)] ${ANCHO[ancho]}`}
      >

        {/* Encabezado */}
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#edf0f4] bg-white px-6 py-5">

          <div className="min-w-0">
            <h2
              id={idTitulo}
              className="font-serif text-2xl font-semibold leading-tight tracking-tight text-[#30203f]"
            >
              {titulo}
            </h2>

            {subtitulo && (
              <div className="mt-1.5 text-sm text-[#68758a]">
                {subtitulo}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onCerrar()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#788294] transition-colors hover:bg-[#f5f1fb] hover:text-[#60379a]"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Contenido */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-white px-6 py-4">
          {children}
        </div>

        {/* Acciones */}
        {pie && (
          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-[#edf0f4] bg-[#fafbfd] px-6 py-4">
            {pie}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
