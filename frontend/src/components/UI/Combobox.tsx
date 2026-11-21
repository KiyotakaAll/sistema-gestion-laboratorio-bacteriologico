import { FloatingPortal, useDismiss, useInteractions, useListNavigation, useRole } from '@floating-ui/react';
import { Check, ChevronDown, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from 'react';
import { normalizarBusqueda, type ControlOption } from './controlTypes';
import { useControlFloating } from './useControlFloating';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'list'> {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly ControlOption[];
  /** Los datalist anteriores admitían texto libre; solo estos usos lo habilitan. */
  allowFreeText?: boolean;
  error?: string;
}

export function Combobox({ value, onValueChange, options, allowFreeText = false, error, disabled, id, className = '', ...props }: Props) {
  const generated = useId();
  const inputId = id ?? generated;
  const listId = `${inputId}-opciones`;
  const statusId = `${inputId}-seleccion`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(value);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const filtered = useMemo(() => options.filter((o) => normalizarBusqueda(query ?? '').split(/\s+/).every((word) => normalizarBusqueda(o.label).includes(word))), [options, query]);
  const list = useRef<Array<HTMLElement | null>>([]);
  const { refs, context, floatingStyles, portalRoot } = useControlFloating(open, setOpen);
  const dismiss = useDismiss(context, { bubbles: false, escapeKey: false });
  const role = useRole(context, { role: 'combobox' });
  const navigation = useListNavigation(context, { listRef: list, activeIndex, onNavigate: setActiveIndex, virtual: true, loop: true, disabledIndices: filtered.flatMap((o, i) => o.disabled ? [i] : []) });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([dismiss, role, navigation]);
  useEffect(() => { if (!open) { setConfirmed(value); setQuery(null); } }, [value, open]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => { if (open && activeIndex !== null) list.current[activeIndex]?.scrollIntoView?.({ block: 'nearest' }); }, [open, activeIndex]);
  function choose(index: number) {
    const option = filtered[index];
    if (!option || option.disabled) return;
    onValueChange(option.value); setConfirmed(option.value); setQuery(null); setOpen(false);
    refs.domReference.current?.focus({ preventScroll: true });
  }
  function openList() { if (!disabled) { setQuery(''); setActiveIndex(null); setOpen(true); } }
  const status = query !== null && query !== ''
    ? (allowFreeText ? 'Texto libre: se conservará lo escrito si no eliges una sugerencia.' : 'Búsqueda pendiente de selección.')
    : confirmed ? `Valor actual: ${options.find((o) => o.value === confirmed)?.label ?? confirmed}` : 'Sin selección.';
  return <div className="lz-combobox">
    <div className="lz-combobox-input">
      <input {...getReferenceProps({ ...props, id: inputId, disabled,
        value: open && query !== null ? query : options.find((option) => option.value === value)?.label ?? value,
        className: `ui-control lz-combobox-control ${className}`,
        'aria-controls': open ? listId : undefined, 'aria-autocomplete': 'list',
        'aria-activedescendant': open && activeIndex !== null ? `${listId}-${activeIndex}` : undefined,
        'aria-describedby': [props['aria-describedby'], statusId, error && `${inputId}-error`].filter(Boolean).join(' '),
        'aria-invalid': error ? true : props['aria-invalid'],
        onFocus: openList,
        onBlur(event) { if (!refs.floating.current?.contains(event.relatedTarget as Node)) setOpen(false); },
        onChange(event: ChangeEvent<HTMLInputElement>) { const text = event.target.value; setQuery(text); setActiveIndex(null); setOpen(true); if (allowFreeText) onValueChange(text); },
        onKeyDown(event) {
          if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
          if (event.key === 'Enter' && open) {
            event.preventDefault();
            if (activeIndex !== null) choose(activeIndex);
            else if (allowFreeText) { setConfirmed(query ?? value); setOpen(false); }
          }
        },
      })} ref={refs.setReference} autoComplete="off" />
      <div className="lz-combobox-actions">
        {(value || query) && <button type="button" disabled={disabled} aria-label={`Limpiar ${props['aria-label'] ?? 'selección'}`} onMouseDown={(e) => e.preventDefault()} onClick={() => { onValueChange(''); setConfirmed(''); setQuery(''); setActiveIndex(null); setOpen(true); refs.domReference.current?.focus(); }}><X size={15} aria-hidden /></button>}
        <button type="button" disabled={disabled} aria-label={`Mostrar opciones de ${props['aria-label'] ?? 'selección'}`} aria-expanded={open} onMouseDown={(e) => e.preventDefault()} onClick={() => { if (open) setOpen(false); else openList(); refs.domReference.current?.focus(); }}><ChevronDown size={17} aria-hidden /></button>
      </div>
    </div>
    <p id={statusId} className="lz-control-hint" aria-live="polite">{status}</p>
    {error && <p id={`${inputId}-error`} className="lz-control-error" role="alert">{error}</p>}
    {open && <FloatingPortal root={portalRoot}>
      <div ref={refs.setFloating} style={floatingStyles} {...getFloatingProps({ id: listId, className: 'labzen-internal lz-control-popover lz-options', 'aria-label': props['aria-label'] ?? 'Sugerencias' })}>
        {filtered.length === 0 && <p className="lz-no-options" role="status">No hay coincidencias.{allowFreeText ? ' Puedes conservar el texto libre.' : ''}</p>}
        {filtered.map((option, index) => <div key={option.value} ref={(node) => { list.current[index] = node; }} {...getItemProps({
          id: `${listId}-${index}`, role: 'option', tabIndex: -1, 'aria-selected': option.value === confirmed, 'aria-disabled': option.disabled || undefined,
          className: `lz-option${activeIndex === index ? ' lz-option-active' : ''}`,
          onMouseDown(e) { e.preventDefault(); }, onClick() { choose(index); },
        })}><span>{option.label}</span>{option.value === confirmed && <Check size={16} aria-hidden />}</div>)}
      </div>
    </FloatingPortal>}
  </div>;
}
