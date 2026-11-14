
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
    'border-[#60379a] bg-[#60379a] text-white hover:border-[#4f2d80] hover:bg-[#4f2d80] disabled:border-[#c6b4df] disabled:bg-[#c6b4df]',

  secundario:
    'border-[#d8deea] bg-white text-[#475467] hover:border-[#c5cddd] hover:bg-[#f8f9fc] disabled:text-[#a3acb9]',

  peligro:
    'border-rose-700 bg-rose-700 text-white hover:bg-rose-800 disabled:border-rose-300 disabled:bg-rose-300',

  fantasma:
    'border-transparent bg-transparent text-[#60379a] hover:bg-[#f5f1fb] disabled:text-[#a3acb9]',
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
      className={`inline-flex shrink-0 items-center justify-center rounded-lg border font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7545ad]/30 disabled:cursor-not-allowed ${VARIANTES[variante]} ${TAMANOS[tamano]} ${className}`}
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
