
import { Loader2 } from 'lucide-react';
import type {
  ButtonHTMLAttributes,
  ReactNode,
} from 'react';

type Variante =
  | 'primario'
  | 'secundario'
  | 'peligro'
  | 'fantasma';

type Tamano = 'sm' | 'md';

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamano?: Tamano;
  cargando?: boolean;
  icono?: ReactNode;
}

const VARIANTES: Record<Variante, string> = {
  primario:
    'border-brand bg-brand text-white hover:border-brand-hover hover:bg-brand-hover disabled:border-[#c6b4df] disabled:bg-[#c6b4df]',

  secundario:
    'border-line bg-surface text-body hover:border-line hover:bg-subtle disabled:text-muted',

  peligro:
    'border-rose-700 bg-rose-700 text-white hover:bg-rose-800 disabled:border-rose-300 disabled:bg-rose-300',

  fantasma:
    'border-transparent bg-transparent text-accent hover:bg-accent-soft disabled:text-muted',
};

const TAMANOS: Record<Tamano, string> = {
  sm: 'h-9 gap-1.5 px-3 text-xs',
  md: 'h-11 gap-2 px-4 text-sm',
};

export function Button({
  variante = 'secundario',
  tamano = 'md',
  cargando = false,
  icono,
  disabled,
  className = '',
  type = 'button',
  children,
  ...resto
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || cargando}
      className={`ui-button inline-flex shrink-0 items-center justify-center rounded-lg border font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed ${VARIANTES[variante]} ${TAMANOS[tamano]} ${className}`}
      {...resto}
    >
      {cargando ? (
        <Loader2
          className="h-4 w-4 animate-spin"
          aria-hidden
        />
      ) : (
        icono
      )}

      {children}
    </button>
  );
}
