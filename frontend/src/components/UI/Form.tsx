
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

const BASE =
  'block w-full rounded-lg border border-[#d8deea] bg-white px-3.5 text-sm text-[#30203f] outline-none transition-colors placeholder:text-[#9aa4b5] focus:border-[#7545ad] focus:ring-2 focus:ring-[#7545ad]/10 disabled:cursor-not-allowed disabled:bg-[#f5f7fa] disabled:text-[#8993a3]';

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
      <span className="mb-1.5 block text-[13px] font-semibold text-[#475467]">
        {etiqueta}
      </span>

      {children}

      {ayuda && (
        <span className="mt-1.5 block text-xs text-[#8993a3]">
          {ayuda}
        </span>
      )}
    </label>
  );
}
