import { FloatingFocusManager, FloatingPortal, useDismiss, useInteractions } from '@floating-ui/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconoCalendario } from '../icons/LabZenIcon';
import { useEffect, useId, useLayoutEffect, useRef, useState, type InputHTMLAttributes, type KeyboardEvent } from 'react';
import { addDays, addMonths, bounded, civilDate, civilParts, civilValue, daysInMonth, displayCivil, parseCivilText, todayCivil, withinBounds } from './civilDate';
import { Select } from './Select';
import { useControlFloating } from './useControlFloating';

export interface DatePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'min' | 'max'> {
  value: string;
  onValueChange: (value: string) => void;
  min?: string;
  max?: string;
  error?: string;
  showToday?: boolean;
}
const MONTHS = Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: new Intl.DateTimeFormat('es-CO', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2020, index, 1))) }));
const longDate = new Intl.DateTimeFormat('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
const monthTitle = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function DatePicker({ value, onValueChange, min, max, disabled, required, error, showToday = true, id, className = '', ...props }: DatePickerProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const panelId = `${inputId}-calendario`;
  const hintId = `${inputId}-formato`;
  const [draft, setDraft] = useState(displayCivil(value));
  const [invalid, setInvalid] = useState(false);
  const [open, setOpen] = useState(false);
  const initial = bounded(civilParts(value) ? value : todayCivil(), min, max);
  const [active, setActive] = useState(initial);
  const [month, setMonth] = useState(initial.slice(0, 7));
  const [yearText, setYearText] = useState(initial.slice(0, 4));
  const input = useRef<HTMLInputElement>(null);
  const dayFocus = useRef<HTMLButtonElement>(null);
  const moveFocus = useRef(false);
  const { refs, context, floatingStyles, portalRoot } = useControlFloating(open, setOpen, false);
  const dismiss = useDismiss(context, { bubbles: false, escapeKey: false });
  const { getFloatingProps } = useInteractions([dismiss]);
  useEffect(() => { setDraft(displayCivil(value)); setInvalid(!!value && !withinBounds(value, min, max)); }, [value, min, max]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => { setYearText(month.slice(0, 4)); }, [month]);
  useEffect(() => { input.current?.setCustomValidity(invalid ? 'Ingresa una fecha válida dentro de los límites indicados.' : ''); }, [invalid]);
  useLayoutEffect(() => {
    if (open && moveFocus.current) { dayFocus.current?.focus({ preventScroll: true }); moveFocus.current = false; }
  }, [active, month, open]);
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  const first = civilValue(year, monthNumber, 1);
  const weekday = (civilDate(first).getUTCDay() + 6) % 7;
  const gridStart = addDays(first, -weekday);
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  function choose(date: string) {
    if (!withinBounds(date, min, max)) return;
    setDraft(displayCivil(date)); setInvalid(false); onValueChange(date); setOpen(false);
  }
  function changeMonth(date: string) {
    const next = bounded(date, min, max);
    setActive(next); setMonth(next.slice(0, 7));
  }
  function openCalendar() {
    const date = bounded(parseCivilText(draft) ?? todayCivil(), min, max);
    setActive(date); setMonth(date.slice(0, 7)); setOpen(true);
  }
  function dayKeys(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    let next: string | undefined;
    const shifts: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (shifts[event.key] !== undefined) next = addDays(date, shifts[event.key]!);
    else if (event.key === 'Home') next = addDays(date, -((civilDate(date).getUTCDay() + 6) % 7));
    else if (event.key === 'End') next = addDays(date, 6 - ((civilDate(date).getUTCDay() + 6) % 7));
    else if (event.key === 'PageUp' || event.key === 'PageDown') next = addMonths(date, (event.key === 'PageUp' ? -1 : 1) * (event.shiftKey ? 12 : 1));
    if (next) { event.preventDefault(); moveFocus.current = true; changeMonth(next); }
  }
  function commitYear() {
    const next = Number(yearText);
    const minimum = min ? Number(min.slice(0, 4)) : 1;
    const maximum = max ? Number(max.slice(0, 4)) : 9999;
    if (/^\d{4}$/.test(yearText) && next >= minimum && next <= maximum) {
      changeMonth(civilValue(next, monthNumber, Math.min(civilParts(active)![2], daysInMonth(next, monthNumber))));
    } else setYearText(String(year).padStart(4, '0'));
  }
  const earlierMonth = addMonths(first, -1);
  const laterMonth = addMonths(first, 1);
  return <div className="lz-date-control">
    <div className="lz-date-input">
      <input {...props} id={inputId} ref={input} type="text" inputMode="numeric" autoComplete="off" value={draft}
        disabled={disabled} required={required} maxLength={10} placeholder={props.placeholder ?? 'DD/MM/AAAA'}
        className={`ui-control lz-date-text ${className}`} aria-invalid={invalid || !!error || props['aria-invalid'] || undefined}
        aria-describedby={[props['aria-describedby'], hintId, (invalid || error) && `${inputId}-error`].filter(Boolean).join(' ')}
        onChange={(event) => {
          const text = event.target.value; setDraft(text);
          if (!text) { setInvalid(false); onValueChange(''); return; }
          const parsed = parseCivilText(text);
          const valid = !!parsed && withinBounds(parsed, min, max);
          setInvalid(!valid);
          if (valid) { setDraft(displayCivil(parsed!)); onValueChange(parsed!); }
        }} onKeyDown={(event) => { if (event.key === 'ArrowDown' && event.altKey) { event.preventDefault(); openCalendar(); } }} />
      <button type="button" ref={refs.setReference} className="lz-date-toggle" disabled={disabled}
        aria-label={`Abrir calendario${props['aria-label'] ? `: ${props['aria-label']}` : ''}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined}
        onClick={() => open ? setOpen(false) : openCalendar()}><IconoCalendario size={18} strokeWidth={1.7} aria-hidden /></button>
    </div>
    <span className="sr-only" id={hintId}>Fecha en formato día/mes/año. También puedes escribir ocho dígitos sin separadores. Alt y flecha abajo abre el calendario.</span>
    {(invalid || error) && <p id={`${inputId}-error`} className="lz-control-error" role="alert">{error ?? 'Ingresa una fecha válida dentro de los límites indicados.'}</p>}
    {open && <FloatingPortal root={portalRoot}>
      <FloatingFocusManager context={context} modal={false} initialFocus={dayFocus} returnFocus>
        <div ref={refs.setFloating} style={floatingStyles} {...getFloatingProps({ id: panelId, role: 'dialog', 'aria-label': 'Elegir fecha', className: 'labzen-internal lz-control-popover lz-calendar' })}>
          <div className="lz-calendar-heading">
            <button type="button" aria-label="Mes anterior" disabled={!!min && earlierMonth.slice(0, 7) < min.slice(0, 7)} onClick={() => changeMonth(addMonths(active, -1))}><ChevronLeft size={18} aria-hidden /></button>
            <p aria-live="polite">{monthTitle.format(civilDate(first))}</p>
            <button type="button" aria-label="Mes siguiente" disabled={!!max && laterMonth.slice(0, 7) > max.slice(0, 7)} onClick={() => changeMonth(addMonths(active, 1))}><ChevronRight size={18} aria-hidden /></button>
          </div>
          <div className="lz-calendar-jump">
            <div><label htmlFor={`${panelId}-mes`}>Mes</label><Select id={`${panelId}-mes`} aria-label="Mes del calendario" value={String(monthNumber)} options={MONTHS}
              onValueChange={(number) => changeMonth(civilValue(year, Number(number), Math.min(civilParts(active)![2], daysInMonth(year, Number(number)))))} /></div>
            <div><label htmlFor={`${panelId}-year`}>Año</label><input id={`${panelId}-year`} aria-label="Año del calendario" className="ui-control" inputMode="numeric" value={yearText} maxLength={4} onChange={(e) => setYearText(e.target.value)} onBlur={commitYear}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitYear(); } }} /></div>
          </div>
          <table className="lz-calendar-grid" role="grid" aria-label={monthTitle.format(civilDate(first))}>
            <thead><tr>{['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'].map((day) => <th key={day} scope="col" abbr={day}>{day.slice(0, 2)}</th>)}</tr></thead>
            <tbody>{Array.from({ length: 6 }, (_, row) => <tr key={row}>{days.slice(row * 7, row * 7 + 7).map((date) => <td key={date} role="gridcell" aria-selected={date === value}>
              <button type="button" ref={date === active ? dayFocus : undefined} tabIndex={date === active ? 0 : -1}
                disabled={!withinBounds(date, min, max)} aria-label={longDate.format(civilDate(date))} aria-current={date === todayCivil() ? 'date' : undefined}
                className={`${date === value ? 'lz-day-selected ' : ''}${date.slice(0, 7) !== month ? 'lz-day-outside' : ''}`}
                onKeyDown={(e) => dayKeys(e, date)} onClick={() => choose(date)}>{Number(date.slice(-2))}</button>
            </td>)}</tr>)}</tbody>
          </table>
          <div className="lz-calendar-footer">
            {showToday && <button type="button" disabled={!withinBounds(todayCivil(), min, max)} onClick={() => choose(todayCivil())}>Hoy</button>}
            {!required && <button type="button" onClick={() => { onValueChange(''); setDraft(''); setInvalid(false); setOpen(false); }}>Limpiar</button>}
            <button type="button" onClick={() => setOpen(false)}>Cerrar calendario</button>
          </div>
          <p className="sr-only">Flechas: cambiar día. Inicio y Fin: semana. Página arriba o abajo: mes. Mayúsculas y Página: año.</p>
        </div>
      </FloatingFocusManager>
    </FloatingPortal>}
  </div>;
}
