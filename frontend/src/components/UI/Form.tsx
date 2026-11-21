import { Children, cloneElement, isValidElement, useId } from 'react';

import type {
  InputHTMLAttributes,
  ReactNode,
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

export { Select } from './Select';

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
  const generated = useId();
  const nodes = Children.toArray(children);
  const child = nodes.find((node) => isValidElement<{ id?: string }>(node));
  const id = isValidElement<{ id?: string }>(child) ? (child.props.id ?? generated) : generated;
  return (
    <div className={`lz-field block ${className}`}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-body">
        {etiqueta}
      </label>

      {nodes.map((node) => node === child && isValidElement<{ id?: string }>(node) ? cloneElement(node, { id }) : node)}

      {ayuda && (
        <span className="mt-1.5 block text-xs text-muted">
          {ayuda}
        </span>
      )}
    </div>
  );
}
