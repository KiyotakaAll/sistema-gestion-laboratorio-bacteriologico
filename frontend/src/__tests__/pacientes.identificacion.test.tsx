import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PacienteFormModal } from '../components/admision/PacienteFormModal';
import { PacienteDetalleModal } from '../components/admision/PacienteDetalleModal';
import { IdentificacionModal } from '../components/admision/IdentificacionModal';
import { ToastProvider } from '../context/ToastContext';
import { pacientesApi, authApi } from '../services/laboratorio';
import AdmisionPacientes from '../pages/AdmisionPacientes';
import { AuthProvider } from '../context/AuthContext';
import type { Paciente, TipoDocumento } from '../types/api';
import { CATALOGO_DOCUMENTOS, identificacionTexto } from '../utils/identificacion';

vi.mock('../services/medicos', () => ({ medicosApi: { capacidades: vi.fn(async () => ({ directorioMedicos: false })) } }));

vi.mock('../services/laboratorio', () => ({
  pacientesApi: { crear: vi.fn(), identificar: vi.fn(), obtener: vi.fn(), capacidades: vi.fn(), listar: vi.fn() },
  authApi: { perfil: vi.fn() },
  solicitudesApi: { crear: vi.fn() },
}));
const paciente: Paciente = { id: 73, cedula: null, nombres: 'Persona Sintética', apellidos: 'Paciente Prueba',
  fechaNacimiento: '2026-01-01T00:00:00.000Z', sexo: 'O', telefono: null, email: null, direccion: null,
  createdAt: '2026-01-01Z', updatedAt: '2026-01-01Z', versionIdentificacion: 0,
  identificacion: { estado: 'SIN_DOCUMENTO_ASIGNADO', tipo: null, numero: null, paisEmisor: null, motivoAusencia: 'Sin documento asignado todavía' } };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(pacientesApi.crear).mockResolvedValue(paciente);
  vi.mocked(pacientesApi.identificar).mockResolvedValue(paciente);
  vi.mocked(pacientesApi.obtener).mockResolvedValue({ ...paciente, solicitudes: [] });
  vi.mocked(pacientesApi.listar).mockResolvedValue({ data: [], page: 1, pageSize: 25, totalPages: 1, total: 0 });
  vi.mocked(authApi.perfil).mockResolvedValue({ id: 7, rol: 'RECEPCIONISTA', nombreCompleto: 'Prueba', username: 'prueba' });
});

describe('Activación de la interfaz según capacidad real del backend', () => {
  it.each([false, true])('identificación habilitada=%s determina el contrato del formulario', async habilitada => {
    localStorage.setItem('lab_token', 'token-sintetico');
    vi.mocked(pacientesApi.capacidades).mockResolvedValue({ identificacionPacientes: habilitada, registroPacientes: true });
    render(<MemoryRouter><ToastProvider><AuthProvider><AdmisionPacientes /></AuthProvider></ToastProvider></MemoryRouter>);
    const boton = await screen.findByRole('button', { name: 'Registrar paciente' });
    await waitFor(() => expect(boton).toBeEnabled());
    await userEvent.click(boton);
    if (habilitada) {
      expect(screen.getByRole('combobox', { name: 'Tipo de documento' })).toBeInTheDocument();
      expect(screen.queryByLabelText('Cédula')).not.toBeInTheDocument();
    } else {
      expect(screen.getByLabelText('Cédula')).toBeRequired();
      expect(screen.queryByRole('combobox', { name: 'Tipo de documento' })).not.toBeInTheDocument();
    }
  });
  it('no ofrece registro si el backend informa que el esquema no está disponible', async () => {
    localStorage.setItem('lab_token', 'token-sintetico');
    vi.mocked(pacientesApi.capacidades).mockResolvedValue({ identificacionPacientes: false, registroPacientes: false });
    render(<MemoryRouter><ToastProvider><AuthProvider><AdmisionPacientes /></AuthProvider></ToastProvider></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('disponibilidad del registro');
    expect(screen.getByRole('button', { name: 'Registrar paciente' })).toBeDisabled();
  });
});
async function datos() {
  const u = userEvent.setup();
  await u.type(screen.getByLabelText('Nombres'), 'Persona Sintética');
  await u.type(screen.getByLabelText('Apellidos'), 'Paciente Prueba');
  fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), { target: { value: '01/01/2020' } });
  return u;
}
async function elegir(u: ReturnType<typeof userEvent.setup>, label: string, option: string) {
  await u.click(screen.getByRole('combobox', { name: label }));
  await u.click(await screen.findByRole('option', { name: option }));
}

describe('Admisión con identificación habilitada por el backend', () => {
  it.each(Object.keys(CATALOGO_DOCUMENTOS) as TipoDocumento[])('registra %s con texto, ceros y controles existentes', async tipo => {
    render(<ToastProvider><PacienteFormModal paciente={null} identificacionHabilitada onCerrar={vi.fn()} onGuardado={vi.fn()} /></ToastProvider>);
    const u = await datos();
    expect(screen.queryByLabelText('Cédula')).not.toBeInTheDocument();
    await elegir(u, 'Tipo de documento', `${tipo} · ${CATALOGO_DOCUMENTOS[tipo].etiqueta}`);
    const numero = tipo === 'PA' ? 'ab001-X' : '00012345';
    expect(screen.getByLabelText('Número de documento')).not.toHaveAttribute('type', 'number');
    await u.type(screen.getByLabelText('Número de documento'), numero);
    if (tipo === 'PA') await elegir(u, 'País emisor', 'Venezuela (VE)');
    else expect(screen.queryByRole('combobox', { name: 'País emisor' })).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Registrar paciente' }));
    await waitFor(() => expect(pacientesApi.crear).toHaveBeenCalledTimes(1));
    const cuerpo = vi.mocked(pacientesApi.crear).mock.calls[0]![0];
    expect(cuerpo).not.toHaveProperty('cedula'); expect(cuerpo).not.toHaveProperty('id');
    expect(cuerpo.identificacion).toEqual({ estado: 'DOCUMENTADO', tipo, numero, ...(tipo === 'PA' ? { paisEmisor: 'VE' } : {}) });
  });
  it.each([
    ['Sin documento asignado', 'SIN_DOCUMENTO_ASIGNADO'],
    ['Documento existente, no disponible', 'DOCUMENTO_NO_DISPONIBLE'],
  ])('registra %s sin número ficticio', async (etiqueta, estado) => {
    render(<ToastProvider><PacienteFormModal paciente={null} identificacionHabilitada onCerrar={vi.fn()} onGuardado={vi.fn()} /></ToastProvider>);
    const u = await datos();
    await elegir(u, 'Estado de identificación', etiqueta);
    expect(screen.queryByLabelText('Número de documento')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Motivo de ausencia del documento')).toBeRequired();
    await u.type(screen.getByLabelText('Motivo de ausencia del documento'), 'Motivo sintético');
    await u.click(screen.getByRole('button', { name: 'Registrar paciente' }));
    await waitFor(() => expect(pacientesApi.crear).toHaveBeenCalledTimes(1));
    expect(vi.mocked(pacientesApi.crear).mock.calls[0]![0].identificacion).toEqual({
      estado, tipo: null, numero: null, paisEmisor: null, motivoAusencia: 'Motivo sintético' });
  });
  it('no deduce un tipo por el número y muestra el error si falta seleccionar tipo', async () => {
    render(<ToastProvider><PacienteFormModal paciente={null} identificacionHabilitada onCerrar={vi.fn()} onGuardado={vi.fn()} /></ToastProvider>);
    const u = await datos();
    await u.type(screen.getByLabelText('Número de documento'), '00123456');
    await u.click(screen.getByRole('button', { name: 'Registrar paciente' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Seleccione el tipo de documento');
    expect(pacientesApi.crear).not.toHaveBeenCalled();
  });
  it('preserva el formulario ante un duplicado documental del backend', async () => {
    vi.mocked(pacientesApi.crear).mockRejectedValue({ isAxiosError: true, response: { data: { error: { code: 'PACIENTE_DUPLICADO', message: 'Ya existe un paciente con esa identificación.' } } } });
    render(<ToastProvider><PacienteFormModal paciente={null} identificacionHabilitada onCerrar={vi.fn()} onGuardado={vi.fn()} /></ToastProvider>);
    const u = await datos(); await elegir(u, 'Tipo de documento', 'CC · Cédula de ciudadanía');
    await u.type(screen.getByLabelText('Número de documento'), '00123456');
    await u.click(screen.getByRole('button', { name: 'Registrar paciente' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe un paciente');
    expect(screen.getByLabelText('Número de documento')).toHaveValue('00123456');
  });
});

describe('Revisión de identidad desde ficha', () => {
  const legado: Paciente = { ...paciente, cedula: '00ab-001', identificacion: { estado: 'LEGADO_POR_REVISAR', tipo: null, numero: null, paisEmisor: null, valorLegado: '00ab-001' } };
  it('muestra el valor original sin inferir CC y envía identificación completa, motivo y versión', async () => {
    const onGuardado = vi.fn();
    render(<ToastProvider><IdentificacionModal paciente={legado} onCerrar={vi.fn()} onGuardado={onGuardado} /></ToastProvider>);
    const u = userEvent.setup();
    expect(screen.getByText(/Valor histórico: 00ab-001/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Tipo de documento' })).toHaveTextContent('Seleccione un tipo');
    await elegir(u, 'Tipo de documento', 'CE · Cédula de extranjería');
    await u.type(screen.getByLabelText('Motivo del cambio'), 'Documento confirmado');
    await u.click(screen.getByRole('button', { name: 'Guardar identificación' }));
    await waitFor(() => expect(pacientesApi.identificar).toHaveBeenCalledWith(73, {
      identificacion: { estado: 'DOCUMENTADO', tipo: 'CE', numero: '00ab-001' }, motivoCambio: 'Documento confirmado', versionIdentificacion: 0 }));
    expect(onGuardado).toHaveBeenCalledTimes(1);
  });
  it('conflicto de versión queda visible, sin reintento automático', async () => {
    vi.mocked(pacientesApi.identificar).mockRejectedValue({ isAxiosError: true, response: { data: { error: { code: 'VERSION_IDENTIFICACION_CONFLICTO', message: 'La identificación cambió. Recargue la ficha.' } } } });
    render(<ToastProvider><IdentificacionModal paciente={paciente} onCerrar={vi.fn()} onGuardado={vi.fn()} /></ToastProvider>);
    const u = userEvent.setup(); await u.type(screen.getByLabelText('Motivo del cambio'), 'Motivo confirmado');
    await u.click(screen.getByRole('button', { name: 'Guardar identificación' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Recargue la ficha');
    expect(pacientesApi.identificar).toHaveBeenCalledTimes(1);
  });
  it('solo muestra la acción de revisión al rol que ya puede editar', async () => {
    vi.mocked(pacientesApi.obtener).mockResolvedValue({ ...legado, solicitudes: [] });
    const { rerender } = render(<MemoryRouter><ToastProvider><PacienteDetalleModal pacienteId={73} puedeEscribir={false} onCerrar={vi.fn()} onCambio={vi.fn()} /></ToastProvider></MemoryRouter>);
    await screen.findByText('00ab-001 · Pendiente de clasificación');
    expect(screen.queryByRole('button', { name: 'Revisar identificación' })).not.toBeInTheDocument();
    rerender(<MemoryRouter><ToastProvider><PacienteDetalleModal pacienteId={73} puedeEscribir onCerrar={vi.fn()} onCambio={vi.fn()} /></ToastProvider></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Revisar identificación' })).toBeInTheDocument();
  });
  it('no presenta el ID interno como identificación de un paciente sin documento', () => {
    expect(identificacionTexto(paciente)).toBe('Sin documento asignado');
    expect(identificacionTexto(paciente)).not.toContain('73');
  });
});
