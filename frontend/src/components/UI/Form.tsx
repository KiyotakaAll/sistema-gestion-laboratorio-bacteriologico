
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

const BASE =
  'ui-control block w-full rounded-lg border border-line bg-surface px-3.5 text-sm text-heading outline-none transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/10 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted';

export function Input({
  className = '',
  ...resto
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`${BASE} h-11 ${className}`}
      {...resto}
    />
  );
}

export function Select({
  className = '',
  children,
  ...resto
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`${BASE} h-11 ${className}`}
      {...resto}
    >
      {children}
    </select>
  );
}

export function Textarea({
  className = '',
  ...resto
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`${BASE} min-h-[100px] resize-y py-3 ${className}`}
      {...resto}
    />
  );
}

interface CampoProps {
  etiqueta: string;
  ayuda?: string;
  children: ReactNode;
  className?: string;
}

export function Campo({
  etiqueta,
  ayuda,
  children,
  className = '',
}: CampoProps) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[13px] font-semibold text-body">
        {etiqueta}
      </span>

      {children}

      {ayuda && (
        <span className="mt-1.5 block text-xs text-muted">
          {ayuda}
        </span>
      )}
    </label>
  );
}
