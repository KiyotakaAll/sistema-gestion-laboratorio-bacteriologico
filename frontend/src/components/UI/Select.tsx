import { FloatingPortal, useClick, useDismiss, useInteractions, useListNavigation, useRole, useTypeahead } from '@floating-ui/react';
import { Check, ChevronDown } from 'lucide-react';
import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { ControlOption } from './controlTypes';
import { useControlFloating } from './useControlFloating';

export interface SelectProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value' | 'onChange' | 'children'> {
  value: string;
  onValueChange: (value: string) => void;
  options?: readonly ControlOption[];
  children?: ReactNode;
  error?: string;
  placeholder?: string;
}

/** Selector de un valor. Conserva también la declaración de opciones <option>. */
export function Select({ value, onValueChange, options, children, disabled, className = '', error, placeholder = 'Selecciona una opción', id, ...props }: SelectProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const listId = `${inputId}-opciones`;
  const choices = useMemo(() => options ?? Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value: string; children: ReactNode; disabled?: boolean }>(child)) return [];
    return [{ value: String(child.props.value), label: String(child.props.children), disabled: child.props.disabled }];
  }), [options, children]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const selectedIndex = choices.findIndex((o) => o.value === value);
  const list = useRef<Array<HTMLElement | null>>([]);
  const labels = useRef<Array<string | null>>([]);
  labels.current = choices.map((o) => o.disabled ? null : o.label);
  const { refs, context, floatingStyles, portalRoot } = useControlFloating(open, setOpen);
  const click = useClick(context, { enabled: !disabled, keyboardHandlers: false });
  const dismiss = useDismiss(context, { bubbles: false, escapeKey: false });
  const role = useRole(context, { role: 'select' });
  const navigation = useListNavigation(context, { listRef: list, activeIndex, selectedIndex, onNavigate: setActiveIndex, virtual: true, loop: true, disabledIndices: choices.flatMap((o, i) => o.disabled ? [i] : []) });
  const typeahead = useTypeahead(context, { listRef: labels, activeIndex, selectedIndex, onMatch: (index) => { if (open) setActiveIndex(index); else if (choices[index]) onValueChange(choices[index].value); } });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([click, dismiss, role, navigation, typeahead]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => { if (open && activeIndex !== null) list.current[activeIndex]?.scrollIntoView?.({ block: 'nearest' }); }, [open, activeIndex]);
  function choose(index: number | null) {
    const option = index === null ? undefined : choices[index];
    if (!option || option.disabled) return;
    onValueChange(option.value); setOpen(false);
    refs.domReference.current?.focus({ preventScroll: true });
  }
  return <>
    <button {...getReferenceProps({
      ...props, id: inputId, type: 'button', disabled, value,
      'aria-controls': open ? listId : undefined,
      'aria-activedescendant': open && activeIndex !== null ? `${listId}-${activeIndex}` : undefined,
      'aria-invalid': error ? true : props['aria-invalid'],
      'aria-describedby': [props['aria-describedby'], error && `${inputId}-error`].filter(Boolean).join(' ') || undefined,
      className: `ui-control lz-select-trigger ${className}`,
      onKeyDown(event) {
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (open) choose(activeIndex ?? selectedIndex); else setOpen(true);
        }
      },
    })} ref={refs.setReference}>
      <span>{choices[selectedIndex]?.label ?? placeholder}</span><ChevronDown size={17} aria-hidden />
    </button>
    {props.name && <input type="hidden" name={props.name} value={value} disabled={disabled} />}
    {open && <FloatingPortal root={portalRoot}>
      <div ref={refs.setFloating} style={floatingStyles} {...getFloatingProps({ id: listId, className: 'labzen-internal lz-control-popover lz-options', 'aria-label': props['aria-label'] ?? 'Opciones' })}>
        {choices.map((option, index) => <div key={option.value} {...getItemProps({
          id: `${listId}-${index}`, role: 'option', tabIndex: -1,
          'aria-selected': option.value === value, 'aria-disabled': option.disabled || undefined,
          className: `lz-option${activeIndex === index ? ' lz-option-active' : ''}`,
          onMouseDown(e) { e.preventDefault(); }, onClick() { choose(index); },
        })} ref={(node) => { list.current[index] = node; }}>
          <span>{option.label}</span>{option.value === value && <Check size={16} aria-hidden />}
        </div>)}
      </div>
    </FloatingPortal>}
    {error && <p id={`${inputId}-error`} className="lz-control-error" role="alert">{error}</p>}
  </>;
}
