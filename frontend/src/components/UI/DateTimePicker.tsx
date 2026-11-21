import { useEffect, useId, useRef, useState } from 'react';
import { DatePicker, type DatePickerProps } from './DatePicker';
import { civilParts } from './civilDate';

interface Props extends Omit<DatePickerProps, 'showToday'> {}
function validLocal(value: string, min?: string, max?: string) {
  const [day, time] = value.split('T');
  const parts = day ? civilParts(day) : null;
  if (!parts || !time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getFullYear() === parts[0] && date.getMonth() + 1 === parts[1]
    && date.getDate() === parts[2] && date.getHours() === Number(time.slice(0, 2))
    && date.getMinutes() === Number(time.slice(3, 5)) && (!min || value >= min) && (!max || value <= max);
}

/** Devuelve YYYY-MM-DDTHH:mm local. La conversión a ISO/UTC sigue en el envío existente. */
export function DateTimePicker({ value, onValueChange, min, max, required, disabled, id, error, ...props }: Props) {
  const generated = useId();
  const inputId = id ?? generated;
  const [day, setDay] = useState(value.split('T')[0] ?? '');
  const [time, setTime] = useState(value.split('T')[1] ?? '');
  const invalid = !!day && !!time && !validLocal(`${day}T${time}`, min, max);
  const emitted = useRef<string | undefined>(undefined);
  const timeInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (value !== emitted.current) { setDay(value.split('T')[0] ?? ''); setTime(value.split('T')[1] ?? ''); } }, [value]);
  useEffect(() => { timeInput.current?.setCustomValidity(invalid ? 'Revisa la fecha y hora local y los límites permitidos.' : ''); }, [invalid]);
  function update(nextDay: string, nextTime: string) {
    const next = `${nextDay}T${nextTime}`;
    const valid = validLocal(next, min, max);
    if (!nextDay || !nextTime) { emitted.current = ''; onValueChange(''); }
    else if (valid) { emitted.current = next; onValueChange(next); }
  }
  return <div className="lz-datetime">
    <DatePicker {...props} id={inputId} value={day} onValueChange={(next) => { setDay(next); update(next, time); }} min={min?.slice(0, 10)} max={max?.slice(0, 10)} required={required} disabled={disabled} />
    <div><label id={`${inputId}-hora-formato`} htmlFor={`${inputId}-hora`} className="lz-control-hint">Hora local · 24 horas · HH:mm o HHmm</label>
      <input ref={timeInput} id={`${inputId}-hora`} className="ui-control lz-time-input" type="text" inputMode="numeric" placeholder="HH:mm" maxLength={5}
        aria-label="Hora de toma" aria-describedby={[`${inputId}-zona`, `${inputId}-hora-formato`, (invalid || error) && `${inputId}-datetime-error`].filter(Boolean).join(' ')} value={time} disabled={disabled} required={required} aria-invalid={invalid || !!error || undefined}
        onChange={(e) => {
          const text = e.target.value;
          const next = /^\d{4}$/.test(text) ? `${text.slice(0, 2)}:${text.slice(2)}` : text;
          setTime(next); update(day, next);
        }} />
    </div>
    <p id={`${inputId}-zona`} className="lz-control-hint">Zona local: {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
    {(invalid || error) && <p id={`${inputId}-datetime-error`} className="lz-control-error" role="alert">{error ?? 'Revisa la fecha y hora local y los límites permitidos.'}</p>}
  </div>;
}
