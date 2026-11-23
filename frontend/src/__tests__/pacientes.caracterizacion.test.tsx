import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PacienteFormModal } from '../components/admision/PacienteFormModal';
import { PacienteDetalleModal } from '../components/admision/PacienteDetalleModal';
import AdmisionPacientes from '../pages/AdmisionPacientes';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { authApi, pacientesApi, solicitudesApi } from '../services/laboratorio';
import type { Paciente, PacienteDetalle, Paginado, SolicitudDetalle } from '../types/api';

vi.mock('../services/laboratorio', () => ({
  authApi: { perfil: vi.fn() },
  pacientesApi: { capacidades: vi.fn(async () => ({ identificacionPacientes: false })), listar: vi.fn(), obtener: vi.fn(), crear: vi.fn(), actualizar: vi.fn() },
  solicitudesApi: { crear: vi.fn() },
}));

// Solo identidades sintéticas. La cédula es deliberadamente distinta del ID.
const paciente: Paciente = {
  id: 73, cedula: '00123456', nombres: 'Persona Sintética', apellidos: 'Paciente Prueba',
  fechaNacimiento: '1990-05-12T00:00:00.000Z', sexo: 'F',
  telefono: '3000000000', email: 'paciente@example.test', direccion: 'Dirección sintética',
  createdAt: '2026-01-01T12:00:00.000Z', updatedAt: '2026-01-01T12:00:00.000Z',
};
const detalle: PacienteDetalle = { ...paciente, solicitudes: [] };
const pagina: Paginado<Paciente> = { data: [paciente], total: 1, page: 1, pageSize: 25, totalPages: 1 };

function formulario(datos: Paciente | null = null) {
  const onGuardado = vi.fn();
  render(<ToastProvider><PacienteFormModal paciente={datos} onCerrar={vi.fn()} onGuardado={onGuardado} /></ToastProvider>);
  return { u: userEvent.setup(), onGuardado };
}

async function llenarObligatorios(u: ReturnType<typeof userEvent.setup>, cedula = '00Ab-123') {
  await u.type(screen.getByLabelText('Cédula'), cedula);
  await u.type(screen.getByLabelText('Nombres'), ' Persona Sintética ');
  await u.type(screen.getByLabelText('Apellidos'), ' Paciente Prueba ');
  fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), { target: { value: '12/05/1990' } });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(pacientesApi.capacidades).mockResolvedValue({ identificacionPacientes: false });
  vi.mocked(pacientesApi.crear).mockResolvedValue(paciente);
  vi.mocked(pacientesApi.actualizar).mockResolvedValue(paciente);
  vi.mocked(pacientesApi.obtener).mockResolvedValue(detalle);
  vi.mocked(pacientesApi.listar).mockResolvedValue(pagina);
  vi.mocked(authApi.perfil).mockResolvedValue({ id: 7, username: 'recepcion-prueba', nombreCompleto: 'Prueba', rol: 'RECEPCIONISTA' });
});

describe('Registro y edición actuales de pacientes', () => {
  it('exige cédula y demás datos obligatorios; envío vacío no llama a la API', async () => {
    const { u } = formulario();
    for (const etiqueta of ['Cédula', 'Nombres', 'Apellidos', 'Fecha de nacimiento']) {
      expect(screen.getByLabelText(etiqueta)).toBeRequired();
      expect(screen.getByLabelText(etiqueta)).toBeInvalid();
    }
    await u.click(screen.getByRole('button', { name: 'Registrar paciente' }));
    expect(pacientesApi.crear).not.toHaveBeenCalled();
  });

  it('envía documento como texto, ceros y letras; DatePicker y Select aportan sus valores reales', async () => {
    const { u, onGuardado } = formulario();
    const documento = screen.getByLabelText('Cédula');
    expect(documento).not.toHaveAttribute('type', 'number');
    await llenarObligatorios(u, ' 000Ab-123 ');
    expect(documento).toHaveValue(' 000Ab-123 ');
    await u.click(screen.getByRole('combobox', { name: 'Sexo' }));
    await u.click(await screen.findByRole('option', { name: 'Otro' }));
    await u.type(screen.getByLabelText('Teléfono'), ' 3001112222 ');
    await u.type(screen.getByLabelText('Correo electrónico'), 'nuevo@example.test');
    await u.type(screen.getByLabelText('Dirección'), ' Dirección de prueba ');
    await u.click(screen.getByRole('button', { name: 'Registrar paciente' }));
    await waitFor(() => expect(pacientesApi.crear).toHaveBeenCalledWith({
      cedula: '000Ab-123', nombres: 'Persona Sintética', apellidos: 'Paciente Prueba',
      fechaNacimiento: '1990-05-12', sexo: 'O', telefono: '3001112222',
      email: 'nuevo@example.test', direccion: 'Dirección de prueba',
    }));
    expect(pacientesApi.crear).toHaveBeenCalledTimes(1);
    expect(onGuardado).toHaveBeenCalledWith(paciente);
  });

  it('DatePicker inválido en registro muestra error e impide enviar', async () => {
    const { u } = formulario();
    await llenarObligatorios(u);
    fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), { target: { value: '31/02/2000' } });
    expect(screen.getByLabelText('Fecha de nacimiento')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Fecha de nacimiento')).toBeInvalid();
    expect(screen.getByText(/Ingresa una fecha válida/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Registrar paciente' }));
    expect(pacientesApi.crear).not.toHaveBeenCalled();
  });

  it('correo inválido bloquea el envío por validez nativa', async () => {
    const { u } = formulario();
    await llenarObligatorios(u);
    await u.type(screen.getByLabelText('Correo electrónico'), 'sin-correo');
    expect(screen.getByLabelText('Correo electrónico')).toBeInvalid();
    await u.click(screen.getByRole('button', { name: 'Registrar paciente' }));
    expect(pacientesApi.crear).not.toHaveBeenCalled();
  });

  it('muestra el mensaje y detalle de validación de la API, conserva el formulario y permite reintentar', async () => {
    vi.mocked(pacientesApi.crear).mockRejectedValueOnce({ isAxiosError: true, response: { status: 400,
      data: { error: { code: 'VALIDACION_FALLIDA', message: 'Los datos enviados no son válidos.',
        details: [{ campo: 'cedula', mensaje: 'La cédula debe tener entre 5 y 20 caracteres alfanuméricos' }] } } } });
    const { u, onGuardado } = formulario();
    await llenarObligatorios(u, '1234');
    // Limitación actual: el input solo exige presencia; longitud/formato se validan en backend.
    await u.click(screen.getByRole('button', { name: 'Registrar paciente' }));
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Los datos enviados no son válidos.');
    expect(alerta).toHaveTextContent('cedula:');
    expect(alerta).toHaveTextContent('entre 5 y 20');
    expect(screen.getByLabelText('Cédula')).toHaveValue('1234');
    expect(screen.getByLabelText('Nombres')).toHaveValue(' Persona Sintética ');
    expect(onGuardado).not.toHaveBeenCalled();
    await u.clear(screen.getByLabelText('Cédula'));
    await u.type(screen.getByLabelText('Cédula'), '00123456');
    await u.click(screen.getByRole('button', { name: 'Registrar paciente' }));
    await waitFor(() => expect(onGuardado).toHaveBeenCalledWith(paciente));
  });

  it('muestra duplicado del backend sin cerrar ni perder los valores', async () => {
    vi.mocked(pacientesApi.crear).mockRejectedValueOnce({ isAxiosError: true, response: { status: 409,
      data: { error: { code: 'PACIENTE_DUPLICADO', message: 'Ya existe un paciente con esa cédula.', details: { pacienteId: 73 } } } } });
    const { u, onGuardado } = formulario();
    await llenarObligatorios(u, paciente.cedula!);
    await u.click(screen.getByRole('button', { name: 'Registrar paciente' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe un paciente con esa cédula.');
    expect(screen.getByLabelText('Cédula')).toHaveValue(paciente.cedula);
    expect(onGuardado).not.toHaveBeenCalled();
  });

  it('edita por ID con cédula deshabilitada; conserva demografía y contactos no tocados', async () => {
    const { u, onGuardado } = formulario(paciente);
    expect(screen.getByLabelText('Cédula')).toBeDisabled();
    expect(screen.getByLabelText('Cédula')).toHaveValue('00123456');
    expect(screen.getByLabelText('Fecha de nacimiento')).toHaveValue('12/05/1990');
    await u.clear(screen.getByLabelText('Nombres'));
    await u.type(screen.getByLabelText('Nombres'), ' Nombre cambiado ');
    await u.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(pacientesApi.actualizar).toHaveBeenCalledWith(73, {
      nombres: 'Nombre cambiado', apellidos: paciente.apellidos, fechaNacimiento: '1990-05-12',
      sexo: 'F', telefono: paciente.telefono, email: paciente.email, direccion: paciente.direccion,
    }));
    expect(pacientesApi.crear).not.toHaveBeenCalled();
    expect(onGuardado).toHaveBeenCalledWith(paciente);
  });

  it('al borrar contactos envía null explícito; omitir un campo ya no lo borra', async () => {
    const { u } = formulario(paciente);
    for (const etiqueta of ['Teléfono', 'Correo electrónico', 'Dirección']) await u.clear(screen.getByLabelText(etiqueta));
    await u.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(pacientesApi.actualizar).toHaveBeenCalledTimes(1));
    const cuerpo = vi.mocked(pacientesApi.actualizar).mock.calls[0]![1];
    expect(cuerpo).toEqual({ nombres: paciente.nombres, apellidos: paciente.apellidos,
      fechaNacimiento: '1990-05-12', sexo: 'F', telefono: null, email: null, direccion: null });
    expect(cuerpo).not.toHaveProperty('cedula');
    // Corrección 1.3C: limpiar se comunica explícitamente también en JSON.
    expect(JSON.parse(JSON.stringify(cuerpo))).toHaveProperty('telefono', null);
  });
});

describe('Directorio y solicitudes con contratos actuales', () => {
  it('búsqueda de admisión envía q textual al backend y presenta documento e ID seleccionado', async () => {
    localStorage.setItem('lab_token', 'token-sintetico');
    render(<MemoryRouter><ToastProvider><AuthProvider><AdmisionPacientes /></AuthProvider></ToastProvider></MemoryRouter>);
    expect(await screen.findByText('00123456')).toBeInTheDocument();
    expect(screen.getByText('Paciente Prueba, Persona Sintética')).toBeInTheDocument();
    const u = userEvent.setup();
    await u.type(screen.getByRole('searchbox'), '00Ab');
    await waitFor(() => expect(pacientesApi.listar).toHaveBeenLastCalledWith({ q: '00Ab', page: 1, pageSize: 25 }));
    await u.click(screen.getByText('00123456'));
    await waitFor(() => expect(pacientesApi.obtener).toHaveBeenCalledWith(73));
    expect(await screen.findByText('Cédula 00123456')).toBeInTheDocument();
  });

  it('nueva solicitud desde el detalle envía pacienteId y prioridad, sin documento', async () => {
    vi.mocked(solicitudesApi.crear).mockResolvedValue({ id: 314, codigo: 'SOL-2026-000001', pacienteId: 73 } as SolicitudDetalle);
    const onCambio = vi.fn();
    render(<MemoryRouter><ToastProvider><PacienteDetalleModal pacienteId={73} puedeEscribir onCerrar={vi.fn()} onCambio={onCambio} /></ToastProvider></MemoryRouter>);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Nueva solicitud' }));
    await u.click(screen.getByRole('combobox', { name: 'Prioridad' }));
    await u.click(await screen.findByRole('option', { name: 'Urgente' }));
    await u.type(screen.getByLabelText('Observaciones'), ' Observación sintética ');
    await u.click(screen.getByRole('button', { name: 'Crear solicitud' }));
    await waitFor(() => expect(solicitudesApi.crear).toHaveBeenCalledWith({ pacienteId: 73,
      prioridad: 'URGENTE', medicoSolicitante: undefined, diagnosticoPresuntivo: undefined, observaciones: 'Observación sintética' }));
    expect(onCambio).toHaveBeenCalledTimes(1);
  });

  it('selecciona una solicitud por su ID al continuar al registro de muestra', async () => {
    vi.mocked(pacientesApi.obtener).mockResolvedValue({ ...detalle, solicitudes: [{
      id: 314, codigo: 'SOL-2026-000001', pacienteId: 73, usuarioIdRegistra: 7,
      medicoSolicitante: null, diagnosticoPresuntivo: null, prioridad: 'RUTINA',
      fechaSolicitud: '2026-01-01T12:00:00Z', observaciones: null,
      createdAt: '2026-01-01T12:00:00Z', updatedAt: '2026-01-01T12:00:00Z', _count: { muestras: 0 },
    }] });
    const { useLocation } = await import('react-router-dom');
    function Ubicacion() { return <output aria-label="Destino">{useLocation().pathname}{useLocation().search}</output>; }
    render(<MemoryRouter initialEntries={['/admision']}><ToastProvider>
      <PacienteDetalleModal pacienteId={73} puedeEscribir onCerrar={vi.fn()} onCambio={vi.fn()} /><Ubicacion />
    </ToastProvider></MemoryRouter>);
    const fila = (await screen.findByText('SOL-2026-000001')).closest('tr')!;
    await userEvent.click(within(fila).getByRole('button', { name: 'Registrar muestra' }));
    expect(screen.getByLabelText('Destino')).toHaveTextContent('/recepcion?solicitudId=314');
  });
});
