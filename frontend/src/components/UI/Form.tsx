import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const BASE =
  'block w-full rounded-sm border border-slate-300 bg-white px-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violeta-500 disabled:bg-slate-100 disabled:text-slate-500';

export function Input({ className = '', ...resto }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${BASE} h-8 ${className}`} {...resto} />;
}

export function Select({ className = '', children, ...resto }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${BASE} h-8 ${className}`} {...resto}>
      {children}
    </select>
  );
}

export function Textarea({ className = '', ...resto }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${BASE} min-h-16 py-1 ${className}`} {...resto} />;
}

interface CampoProps {
  etiqueta: string;
  ayuda?: string;
  children: ReactNode;
  className?: string;
}

/** Etiqueta + control. El <label> envuelve al control, así queda asociado sin ids. */
export function Campo({ etiqueta, ayuda, children, className = '' }: CampoProps) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-0.5 block text-xs font-semibold text-slate-600">{etiqueta}</span>
      {children}
      {ayuda && <span className="mt-0.5 block text-2xs text-slate-500">{ayuda}</span>}
    </label>
  );
}
