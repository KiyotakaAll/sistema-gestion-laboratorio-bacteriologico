import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variante = 'primario' | 'secundario' | 'peligro' | 'fantasma';
type Tamano = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamano?: Tamano;
  cargando?: boolean;
  icono?: ReactNode;
}

const VARIANTES: Record<Variante, string> = {
  primario: 'border-violeta-800 bg-violeta-700 text-white hover:bg-violeta-800 disabled:bg-violeta-300 disabled:border-violeta-300',
  secundario: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-400',
  peligro: 'border-rose-800 bg-rose-700 text-white hover:bg-rose-800 disabled:bg-rose-300 disabled:border-rose-300',
  fantasma: 'border-transparent bg-transparent text-violeta-700 hover:bg-violeta-50 disabled:text-slate-400',
};

const TAMANOS: Record<Tamano, string> = {
  sm: 'h-7 px-2 text-xs gap-1',
  md: 'h-8 px-3 text-sm gap-1.5',
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
      className={`inline-flex items-center justify-center rounded-sm border font-semibold disabled:cursor-not-allowed ${VARIANTES[variante]} ${TAMANOS[tamano]} ${className}`}
      {...resto}
    >
      {cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : icono}
      {children}
    </button>
  );
}
