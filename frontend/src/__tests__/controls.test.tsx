import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatePicker } from '../components/UI/DatePicker';
import { DateTimePicker } from '../components/UI/DateTimePicker';
import { Select } from '../components/UI/Select';
import { Combobox } from '../components/UI/Combobox';
import { Campo } from '../components/UI/Form';
import { Modal } from '../components/UI/Modal';
import { addDays, civilDate, displayCivil, parseCivilText, todayCivil } from '../components/UI/civilDate';

afterEach(() => vi.restoreAllMocks());
const options = [{ value: 'orina', label: 'Orina' }, { value: 'faringeo', label: 'Exudado faríngeo' }, { value: 'sangre', label: 'Sangre' }, { value: 'off', label: 'No disponible', disabled: true }];
function DateHarness({ initial = '1990-05-12', min, max, disabled = false, required = false }: { initial?: string; min?: string; max?: string; disabled?: boolean; required?: boolean }) {
  const [value, setValue] = useState(initial);
  return <div className="labzen-internal"><Campo etiqueta="Fecha"><DatePicker value={value} onValueChange={setValue} min={min} max={max} disabled={disabled} required={required} /></Campo><output aria-label="Valor civil">{value}</output></div>;
}
async function calendar() {
  await userEvent.click(screen.getByRole('button', { name: 'Abrir calendario' }));
  return screen.findByRole('dialog', { name: 'Elegir fecha' });
}

describe('DatePicker: fecha civil y teclado', () => {
  it('elige un día y devuelve YYYY-MM-DD sin conversión de zona', async () => {
    render(<DateHarness />); await calendar();
    await userEvent.click(screen.getByRole('button', { name: /15 de mayo de 1990/ }));
    expect(screen.getByLabelText('Valor civil')).toHaveTextContent('1990-05-15');
    expect(screen.getByLabelText('Fecha')).toHaveValue('15/05/1990');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('permite escribir, reemplazar y limpiar fechas válidas', () => {
    render(<DateHarness />);
    const input = screen.getByLabelText('Fecha');
    fireEvent.change(input, { target: { value: '29/02/2000' } });
    expect(screen.getByLabelText('Valor civil')).toHaveTextContent('2000-02-29');
    fireEvent.change(input, { target: { value: '2001-03-04' } });
    expect(input).toHaveValue('04/03/2001');
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByLabelText('Valor civil')).toBeEmptyDOMElement();
  });
  it('acepta ocho dígitos desde un teclado numérico móvil sin exigir barras', async () => {
    render(<DateHarness initial="" />);
    await userEvent.type(screen.getByLabelText('Fecha'), '29112000');
    expect(screen.getByLabelText('Valor civil')).toHaveTextContent('2000-11-29');
    expect(screen.getByLabelText('Fecha')).toHaveValue('29/11/2000');
  });
  it('no normaliza ni emite el 31 de febrero, un no bisiesto o una fecha fuera de límites', () => {
    render(<DateHarness min="1900-01-01" max="2020-01-01" />);
    const input = screen.getByLabelText('Fecha');
    for (const value of ['31/02/2000', '29/02/1900', '01/01/1800', '01/01/2030']) {
      fireEvent.change(input, { target: { value } });
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toBeInvalid();
      expect(screen.getByLabelText('Valor civil')).toHaveTextContent('1990-05-12');
    }
  });
  it('cambia directamente mes y año para una persona de edad avanzada', async () => {
    render(<DateHarness min="1900-01-01" max={todayCivil()} />); await calendar();
    const year = screen.getByRole('textbox', { name: 'Año del calendario' });
    fireEvent.change(year, { target: { value: '1900' } });
    fireEvent.keyDown(year, { key: 'Enter' });
    await userEvent.click(screen.getByRole('combobox', { name: 'Mes del calendario' }));
    await userEvent.click(await screen.findByRole('option', { name: 'enero' }));
    await userEvent.click(screen.getByRole('button', { name: /\b1 de enero de 1900/ }));
    expect(screen.getByLabelText('Valor civil')).toHaveTextContent('1900-01-01');
  });
  it('permite nacimiento de hoy y distingue hoy del valor seleccionado', async () => {
    render(<DateHarness max={todayCivil()} />); await calendar();
    await userEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(screen.getByLabelText('Valor civil')).toHaveTextContent(todayCivil());
    await calendar();
    expect(document.querySelector('[aria-current="date"]')).toBeInTheDocument();
    expect(document.querySelector('[aria-selected="true"] button')).toHaveAttribute('aria-current', 'date');
  });
  it('limita los días y los botones de navegación', async () => {
    render(<DateHarness initial="2020-05-12" min="2020-05-10" max="2020-05-15" />); await calendar();
    expect(screen.getByRole('button', { name: /\b9 de mayo de 2020/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /16 de mayo de 2020/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hoy' })).toBeDisabled();
  });
  it('soporta flechas, Inicio/Fin y cambios de mes/año con Página', async () => {
    render(<DateHarness />); await calendar();
    const u = userEvent.setup();
    await waitFor(() => expect(screen.getByRole('button', { name: /12 de mayo de 1990/ })).toHaveFocus());
    await u.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: /13 de mayo de 1990/ })).toHaveFocus();
    await u.keyboard('{Home}');
    expect(screen.getByRole('button', { name: /\b7 de mayo de 1990/ })).toHaveFocus();
    await u.keyboard('{End}');
    await u.keyboard('{PageDown}');
    expect(screen.getByRole('button', { name: /13 de junio de 1990/ })).toHaveFocus();
    await u.keyboard('{Shift>}{PageUp}{/Shift}');
    expect(screen.getByRole('button', { name: /13 de junio de 1989/ })).toHaveFocus();
    await u.keyboard('{Enter}');
    expect(screen.getByLabelText('Valor civil')).toHaveTextContent('1989-06-13');
  });
  it('navega meses y cierra con Escape devolviendo foco al botón', async () => {
    render(<DateHarness />); await calendar();
    await userEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(screen.getByRole('grid')).toHaveAccessibleName('junio de 1990');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Abrir calendario' })).toHaveFocus();
  });
  it('abre desde el teclado y cierra al hacer clic fuera', async () => {
    render(<><DateHarness /><button>Fuera</button></>);
    screen.getByLabelText('Fecha').focus();
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Fuera' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('deshabilitado impide escritura y apertura', () => {
    render(<DateHarness disabled />);
    expect(screen.getByLabelText('Fecha')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Abrir calendario' })).toBeDisabled();
  });
  it('conserva un valor externo fuera de límites e informa del error', () => {
    render(<DateHarness initial="1899-12-31" min="1900-01-01" />);
    expect(screen.getByLabelText('Fecha')).toHaveValue('31/12/1899');
    expect(screen.getByLabelText('Fecha')).toBeInvalid();
    expect(screen.getByLabelText('Valor civil')).toHaveTextContent('1899-12-31');
  });
});

function TimeHarness({ max = '2020-05-20T13:00' }: { max?: string }) {
  const [value, setValue] = useState('2020-05-12T10:15');
  return <Campo etiqueta="Toma"><DateTimePicker aria-label="Toma" value={value} onValueChange={setValue} max={max} required /><output aria-label="Hora local">{value}</output></Campo>;
}
describe('DateTimePicker', () => {
  it('cambia fecha y hora conservando el contrato local del formulario', () => {
    render(<TimeHarness />);
    fireEvent.change(screen.getByLabelText('Toma'), { target: { value: '14/05/2020' } });
    fireEvent.change(screen.getByLabelText('Hora de toma'), { target: { value: '11:30' } });
    expect(screen.getByLabelText('Hora local')).toHaveTextContent('2020-05-14T11:30');
  });
  it('permite borrar y reescribir la hora sin perder la fecha', async () => {
    render(<TimeHarness />);
    const u = userEvent.setup(); const input = screen.getByLabelText('Hora de toma');
    await u.clear(input); await u.type(input, '09:45');
    expect(screen.getByLabelText('Hora local')).toHaveTextContent('2020-05-12T09:45');
  });
  it('rechaza horas imposibles o posteriores al límite sin cambiar el valor previo', () => {
    render(<TimeHarness max="2020-05-12T13:00" />);
    const input = screen.getByLabelText('Hora de toma');
    for (const time of ['25:00', '12:99', '14:00']) {
      fireEvent.change(input, { target: { value: time } });
      expect(input).toBeInvalid();
      expect(screen.getByLabelText('Hora local')).toHaveTextContent('2020-05-12T10:15');
    }
  });
  it('permite escribir HHmm desde móvil y vuelve a validar si cambia el límite', async () => {
    const { rerender } = render(<TimeHarness max="2020-05-12T13:00" />);
    const input = screen.getByLabelText('Hora de toma');
    await userEvent.clear(input); await userEvent.type(input, '1230');
    expect(input).toHaveValue('12:30');
    expect(screen.getByLabelText('Hora local')).toHaveTextContent('2020-05-12T12:30');
    rerender(<TimeHarness max="2020-05-12T12:00" />);
    expect(input).toBeInvalid();
    expect(screen.getByLabelText('Hora local')).toHaveTextContent('2020-05-12T12:30');
  });
});

function SelectHarness({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState('orina');
  return <Campo etiqueta="Categoría"><Select value={value} onValueChange={setValue} options={options} disabled={disabled} /></Campo>;
}
describe('Select de LabZen', () => {
  it('abre, indica la selección y la reemplaza con clic', async () => {
    render(<SelectHarness />); const u = userEvent.setup();
    await u.click(screen.getByRole('combobox', { name: 'Categoría' }));
    expect(await screen.findByRole('option', { name: 'Orina' })).toHaveAttribute('aria-selected', 'true');
    await u.click(screen.getByRole('option', { name: 'Sangre' }));
    expect(screen.getByRole('combobox', { name: 'Categoría' })).toHaveValue('sangre');
    expect(screen.queryByRole('listbox')).toBeNull();
  });
  it('navega por teclado, omite deshabilitados y confirma sin enviar el formulario', async () => {
    const submit = vi.fn((e) => e.preventDefault());
    render(<form onSubmit={submit}><SelectHarness /></form>);
    const u = userEvent.setup(); screen.getByRole('combobox').focus();
    await u.keyboard('{ArrowDown}');
    await screen.findByRole('listbox');
    await u.keyboard('{End}{Enter}');
    expect(screen.getByRole('combobox')).toHaveValue('sangre');
    expect(submit).not.toHaveBeenCalled();
  });
  it('Escape y Tab cierran, y conserva un nombre accesible explícito', async () => {
    render(<SelectHarness />); const u = userEvent.setup();
    await u.click(screen.getByRole('combobox')); await u.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    await u.click(screen.getByRole('combobox')); await u.keyboard('{Tab}');
    expect(screen.queryByRole('listbox')).toBeNull();
  });
  it('ignora opciones deshabilitadas y no abre si está deshabilitado', async () => {
    const { unmount } = render(<SelectHarness />);
    await userEvent.click(screen.getByRole('combobox')); await userEvent.click(screen.getByRole('option', { name: 'No disponible' }));
    expect(screen.getByRole('combobox')).toHaveValue('orina'); unmount();
    render(<SelectHarness disabled />); await userEvent.click(screen.getByRole('combobox'));
    expect(screen.queryByRole('listbox')).toBeNull();
  });
  it('cierra al pulsar fuera y asocia el mensaje de error al campo', async () => {
    render(<><Select aria-label="Estado" value="orina" onValueChange={vi.fn()} options={options} error="Revisa el estado" /><button>Fuera</button></>);
    const input = screen.getByRole('combobox');
    expect(input).toHaveAccessibleDescription('Revisa el estado');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    await userEvent.click(input); await userEvent.click(screen.getByRole('button', { name: 'Fuera' }));
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

function ComboHarness({ free = false, disabled = false }: { free?: boolean; disabled?: boolean }) {
  const [value, setValue] = useState('orina');
  return <><Campo etiqueta="Muestra"><Combobox aria-label="Muestra" value={value} onValueChange={setValue} options={options} allowFreeText={free} disabled={disabled} /></Campo><output aria-label="Confirmado">{value}</output></>;
}
describe('Combobox reutilizable', () => {
  it('encuentra fari ignorando tildes, mayúsculas y fragmentos; confirma con Enter', async () => {
    render(<ComboHarness />); const u = userEvent.setup();
    await u.click(screen.getByRole('combobox', { name: 'Muestra' }));
    await u.type(screen.getByRole('combobox', { name: 'Muestra' }), 'FARI');
    expect(await screen.findByRole('option', { name: 'Exudado faríngeo' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Orina' })).toBeNull();
    expect(screen.getByLabelText('Confirmado')).toHaveTextContent('orina');
    await u.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByLabelText('Confirmado')).toHaveTextContent('faringeo');
    expect(screen.getByRole('combobox', { name: 'Muestra' })).toHaveValue('Exudado faríngeo');
  });
  it('reemplaza la elección anterior sin borrar letra por letra y permite limpiar', async () => {
    render(<ComboHarness />); const u = userEvent.setup();
    const input = screen.getByRole('combobox', { name: 'Muestra' });
    await u.click(input); await u.type(input, 'san'); await u.click(screen.getByRole('option', { name: 'Sangre' }));
    expect(screen.getByLabelText('Confirmado')).toHaveTextContent('sangre');
    await u.click(screen.getByRole('button', { name: 'Limpiar Muestra' }));
    expect(screen.getByLabelText('Confirmado')).toBeEmptyDOMElement();
  });
  it('muestra ausencia de coincidencias y Escape descarta la búsqueda sin confirmar', async () => {
    render(<ComboHarness />); const u = userEvent.setup();
    await u.click(screen.getByRole('combobox')); await u.type(screen.getByRole('combobox'), 'sin coincidencia');
    expect(screen.getByText(/No hay coincidencias/)).toBeInTheDocument();
    await u.keyboard('{Escape}');
    expect(screen.getByRole('combobox')).toHaveValue('Orina');
  });
  it('mantiene el texto libre admitido por los datalist existentes', async () => {
    render(<ComboHarness free />); const u = userEvent.setup();
    await u.click(screen.getByRole('combobox')); await u.type(screen.getByRole('combobox'), 'Tipo ya permitido');
    expect(screen.getByLabelText('Confirmado')).toHaveTextContent('Tipo ya permitido');
    expect(screen.getByText(/se conservará lo escrito/)).toBeInTheDocument();
  });
  it('impide apertura y escritura al deshabilitar', async () => {
    render(<ComboHarness disabled />); await userEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('combobox')).toBeDisabled(); expect(screen.queryByRole('listbox')).toBeNull();
  });
});

describe('Controles dentro del Modal existente', () => {
  it('los portales siguen dentro del diálogo y Escape cierra solo la capa superior', async () => {
    const close = vi.fn();
    render(<Modal abierto titulo="Paciente" onCerrar={close}><DateHarness /></Modal>);
    const u = userEvent.setup();
    const parent = screen.getByRole('dialog', { name: 'Paciente' });
    const date = await calendar(); expect(parent).toContainElement(date);
    await u.click(screen.getByRole('combobox', { name: 'Mes del calendario' }));
    expect(date).toContainElement(await screen.findByRole('listbox'));
    expect(screen.getByRole('listbox').closest('[inert]')).toBeNull();
    await u.keyboard('{Escape}'); expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Elegir fecha' })).toBeInTheDocument(); expect(close).not.toHaveBeenCalled();
    await u.keyboard('{Escape}'); expect(screen.queryByRole('dialog', { name: 'Elegir fecha' })).toBeNull(); expect(close).not.toHaveBeenCalled();
    await u.keyboard('{Escape}'); expect(close).toHaveBeenCalledOnce();
  });
  it('se conserva el foco en el modal al usar Tab dentro del calendario', async () => {
    render(<Modal abierto titulo="Paciente" onCerrar={vi.fn()}><DateHarness /><button>Final</button></Modal>);
    const parent = screen.getByRole('dialog', { name: 'Paciente' });
    await calendar(); await userEvent.keyboard('{Tab}{Tab}{Shift>}{Tab}{/Shift}');
    expect(parent).toContainElement(document.activeElement as HTMLElement);
  });
});

it('la aritmética civil conserva días en cualquier zona y no normaliza entradas inválidas', async () => {
  expect(displayCivil('1900-01-01')).toBe('01/01/1900');
  expect(civilDate('1900-01-01').getUTCDate()).toBe(1);
  expect(addDays('2020-02-28', 1)).toBe('2020-02-29');
  expect(addDays('2020-02-29', 1)).toBe('2020-03-01');
  expect(parseCivilText('31/04/2020')).toBeNull();
  await act(async () => {});
});
