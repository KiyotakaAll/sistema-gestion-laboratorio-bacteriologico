import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import App from '../App';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { MedicoFormModal } from '../components/medicos/MedicoFormModal';
import { MedicoSelector } from '../components/medicos/MedicoSelector';
import { RemitenteSolicitudModal } from '../components/medicos/RemitenteSolicitudModal';
import { PacienteDetalleModal } from '../components/admision/PacienteDetalleModal';
import { medicosApi } from '../services/medicos';
import { authApi, pacientesApi, solicitudesApi } from '../services/laboratorio';
import type { MedicoRemitente } from '../types/medicos';
import type { PacienteDetalle, RolNombre, SolicitudDetalle } from '../types/api';

vi.mock('../services/catalogos', () => ({ catalogosApi: { flujo: vi.fn(async () => ({ habilitado: false, tiposMuestra: [], sitios: [], plantillas: [] })) } }));

vi.mock('../services/medicos', () => ({ medicosApi: {
  capacidades: vi.fn(), listar: vi.fn(), obtener: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), estado: vi.fn(), asignar: vi.fn(),
} }));
vi.mock('../services/laboratorio', () => ({ authApi: { perfil: vi.fn() },
  pacientesApi: { obtener: vi.fn() }, solicitudesApi: { crear: vi.fn(), obtener: vi.fn() },
}));
const medico: MedicoRemitente = { id: 3, nombres: 'Ana', apellidos: 'Prueba', registroProfesional: null,
  especialidad: null, telefono: null, email: null, institucion: 'Clínica Norte', activo: true,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
const pagina = { data: [medico], total: 1, page: 1, pageSize: 25, totalPages: 1 };
const solicitud = { id: 20, codigo: 'SOL-2026-000020', medicoSolicitante: ' Dr. Histórico ', medicoRemitenteId: null,
  medicoRemitenteNombre: null, prioridad: 'RUTINA', fechaSolicitud: '2026-01-01T00:00:00Z', _count: { muestras: 0 } };
const paciente = { id: 73, cedula: '00073', nombres: 'Persona', apellidos: 'Sintética', fechaNacimiento: '1990-01-01T00:00:00Z',
  sexo: 'F', telefono: null, email: null, direccion: null, solicitudes: [solicitud] } as unknown as PacienteDetalle;
const conflicto = { isAxiosError: true, response: { status: 409, data: { error: { code: 'MEDICO_DUPLICADO', message: 'Ya existe ese registro profesional.' } } } };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(authApi.perfil).mockResolvedValue({ id: 7, username: 'recepcion', nombreCompleto: 'Usuario Prueba', rol: 'RECEPCIONISTA' });
  vi.mocked(medicosApi.capacidades).mockResolvedValue({ directorioMedicos: true });
  vi.mocked(medicosApi.listar).mockResolvedValue(pagina);
  vi.mocked(medicosApi.crear).mockResolvedValue(medico);
  vi.mocked(medicosApi.actualizar).mockResolvedValue(medico);
  vi.mocked(medicosApi.estado).mockResolvedValue({ ...medico, activo: false });
  vi.mocked(medicosApi.asignar).mockResolvedValue(solicitud as unknown as SolicitudDetalle);
  vi.mocked(solicitudesApi.obtener).mockResolvedValue(solicitud as unknown as SolicitudDetalle);
  vi.mocked(solicitudesApi.crear).mockResolvedValue(solicitud as unknown as SolicitudDetalle);
  vi.mocked(pacientesApi.obtener).mockResolvedValue(paciente);
});
function abrir(rol: RolNombre = 'RECEPCIONISTA') {
  localStorage.setItem('lab_token', 'token-ficticio');
  vi.mocked(authApi.perfil).mockResolvedValue({ id: 7, username: 'prueba', nombreCompleto: 'Usuario Prueba', rol });
  return render(<MemoryRouter initialEntries={['/medicos']}><AuthProvider><App /></AuthProvider></MemoryRouter>);
}
function ficha() {
  render(<MemoryRouter><ToastProvider><PacienteDetalleModal pacienteId={73} puedeEscribir
    onCerrar={vi.fn()} onCambio={vi.fn()} /></ToastProvider></MemoryRouter>);
}
it('deshabilitado muestra disponibilidad y no consulta tablas ni ofrece creación', async () => {
  vi.mocked(medicosApi.capacidades).mockResolvedValue({ directorioMedicos: false });abrir();
  expect(await screen.findByText('El directorio de médicos aún no está habilitado.')).toBeInTheDocument();
  expect(medicosApi.listar).not.toHaveBeenCalled();expect(screen.queryByRole('button', { name: 'Nuevo médico' })).not.toBeInTheDocument();
});
it('si falla capacidad no intenta consultar el directorio', async () => {
  vi.mocked(medicosApi.capacidades).mockRejectedValue({ isAxiosError: true, response: { status: 503, data: { error: { message: 'No disponible' } } } });abrir();
  expect(await screen.findByText('No disponible')).toBeInTheDocument();expect(medicosApi.listar).not.toHaveBeenCalled();
});
it('directorio presenta búsqueda, paginación y datos opcionales', async () => {
  vi.mocked(medicosApi.listar).mockResolvedValue({ ...pagina, total: 26, totalPages: 2 });abrir();
  expect(await screen.findByText('Ana Prueba')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Médicos remitentes' })).toHaveAttribute('aria-current', 'page');
  fireEvent.change(screen.getByLabelText('Buscar médicos'), { target: { value: 'Clínica' } });
  await waitFor(() => expect(medicosApi.listar).toHaveBeenLastCalledWith({ q: 'Clínica', estado: 'todos', page: 1, pageSize: 25 }));
  await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));
  await waitFor(() => expect(medicosApi.listar).toHaveBeenLastCalledWith({ q: 'Clínica', estado: 'todos', page: 2, pageSize: 25 }));
});
for (const rol of ['BACTERIOLOGO', 'VALIDADOR'] as const) it(`${rol} consulta sin controles de escritura`, async () => {
  abrir(rol);await screen.findByText('Ana Prueba');
  expect(screen.queryByRole('button', { name: 'Nuevo médico' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Editar Ana Prueba' })).not.toBeInTheDocument();
});
it('crea sin inventar registro y cierra tras guardar', async () => {
  abrir();await userEvent.click(await screen.findByRole('button', { name: 'Nuevo médico' }));
  const modal=screen.getByRole('dialog', { name: 'Nuevo médico remitente' });
  await userEvent.type(within(modal).getByLabelText('Nombres'), 'Luisa');
  await userEvent.type(within(modal).getByLabelText('Apellidos'), 'Prueba');
  await userEvent.click(within(modal).getByRole('button', { name: 'Guardar médico' }));
  await waitFor(() => expect(medicosApi.crear).toHaveBeenCalledExactlyOnceWith({ nombres: 'Luisa', apellidos: 'Prueba', registroProfesional: null,
    especialidad: null, telefono: null, email: null, institucion: null }));
  expect(await screen.findByText('Médico guardado.')).toBeInTheDocument();
});
it('edita y envía null al limpiar contactos; cancelar no guarda', async () => {
  const onGuardado=vi.fn(), onCerrar=vi.fn();
  render(<MedicoFormModal medico={{ ...medico, email: 'ana@example.test' }} onGuardado={onGuardado} onCerrar={onCerrar} />);
  await userEvent.clear(screen.getByLabelText('Correo electrónico'));
  await userEvent.click(screen.getByRole('button', { name: 'Guardar médico' }));
  await waitFor(() => expect(medicosApi.actualizar).toHaveBeenCalledWith(3, expect.objectContaining({ email: null })));
  expect(onGuardado).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));expect(onCerrar).toHaveBeenCalledOnce();
});
it('conserva ficha y error de duplicado al rechazar guardado', async () => {
  vi.mocked(medicosApi.crear).mockRejectedValue(conflicto);
  render(<MedicoFormModal onCerrar={vi.fn()} onGuardado={vi.fn()} />);
  await userEvent.type(screen.getByLabelText('Nombres'), 'Ana');await userEvent.type(screen.getByLabelText('Apellidos'), 'Prueba');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar médico' }));
  expect(await screen.findByText('Ya existe ese registro profesional.')).toBeInTheDocument();
  expect(screen.getByLabelText('Nombres')).toHaveValue('Ana');expect(screen.getByRole('button', { name: 'Guardar médico' })).toBeEnabled();
});
it('bloquea doble envío y cierre mientras guarda', async () => {
  vi.mocked(medicosApi.crear).mockReturnValue(new Promise(() => {}));const cerrar=vi.fn();
  render(<MedicoFormModal onCerrar={cerrar} onGuardado={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Nombres'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByLabelText('Apellidos'), { target: { value: 'Prueba' } });
  const form=screen.getByLabelText('Nombres').closest('form')!;fireEvent.submit(form);fireEvent.submit(form);
  expect(medicosApi.crear).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));expect(cerrar).not.toHaveBeenCalled();
});
for (const activo of [true, false]) it(`${activo ? 'desactiva' : 'activa'} con confirmación sin borrar datos`, async () => {
  vi.mocked(medicosApi.listar).mockResolvedValue({ ...pagina, data: [{ ...medico, activo }] });abrir();
  await userEvent.click(await screen.findByRole('button', { name: `${activo ? 'Desactivar' : 'Activar'} Ana Prueba` }));
  expect(medicosApi.estado).not.toHaveBeenCalled();
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar' }));
  await waitFor(() => expect(medicosApi.estado).toHaveBeenCalledExactlyOnceWith(3, !activo));
});
it('selección busca solo activos y confirma un ID entre homónimos', async () => {
  vi.mocked(medicosApi.listar).mockResolvedValue({ ...pagina, data: [medico, { ...medico, id: 4, institucion: 'Clínica Sur' }] });
  const cambio=vi.fn();render(<MedicoSelector value={null} onChange={cambio} />);
  await waitFor(() => expect(medicosApi.listar).toHaveBeenCalledWith({ q: '', estado: 'activos', page: 1, pageSize: 25 }));
  await userEvent.click(screen.getByRole('combobox'));
  await userEvent.click(await screen.findByRole('option', { name: /ID 4.*Clínica Sur/ }));expect(cambio).toHaveBeenLastCalledWith(4);
  fireEvent.change(screen.getByLabelText('Buscar en el directorio'), { target: { value: 'Sur' } });
  await waitFor(() => expect(medicosApi.listar).toHaveBeenLastCalledWith({ q: 'Sur', estado: 'activos', page: 1, pageSize: 25 }));
});
it('ficha con bandera apagada conserva formulario y cuerpo antiguo', async () => {
  vi.mocked(medicosApi.capacidades).mockResolvedValue({ directorioMedicos: false });ficha();
  await userEvent.click(await screen.findByRole('button', { name: 'Nueva solicitud' }));
  await userEvent.type(screen.getByLabelText('Médico solicitante'), 'Dr. Libre');
  await userEvent.click(screen.getByRole('button', { name: 'Crear solicitud' }));
  await waitFor(() => expect(solicitudesApi.crear).toHaveBeenCalledWith(expect.objectContaining({ medicoSolicitante: 'Dr. Libre', pacienteId: 73 })));
  expect(solicitudesApi.crear).not.toHaveBeenCalledWith(expect.objectContaining({ medicoRemitenteId: expect.anything() }));
  expect(medicosApi.listar).not.toHaveBeenCalled();
});
it('nueva solicitud envía solo el ID elegido y conserva el paciente', async () => {
  ficha();await userEvent.click(await screen.findByRole('button', { name: 'Nueva solicitud' }));
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Médico del directorio' })).toBeEnabled());
  await userEvent.click(screen.getByRole('combobox', { name: 'Médico del directorio' }));
  await userEvent.click(await screen.findByRole('option', { name: /Ana Prueba.*ID 3/ }));
  expect(screen.getByLabelText('Médico solicitante')).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Crear solicitud' }));
  await waitFor(() => expect(solicitudesApi.crear).toHaveBeenCalledWith(expect.objectContaining({ pacienteId: 73, medicoRemitenteId: 3 })));
  expect(vi.mocked(solicitudesApi.crear).mock.calls[0]![0]).not.toHaveProperty('medicoSolicitante');
});
it('editar remitente conserva texto histórico visible y envía únicamente vínculo', async () => {
  const guardado=vi.fn();render(<RemitenteSolicitudModal solicitudId={20} onCerrar={vi.fn()} onGuardado={guardado} />);
  expect(await screen.findByText(/Remitente al ingreso:/)).toHaveTextContent('Dr. Histórico');
  await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());
  await userEvent.click(screen.getByRole('combobox'));await userEvent.click(await screen.findByRole('option', { name: /Ana Prueba.*ID 3/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Guardar remitente' }));
  await waitFor(() => expect(medicosApi.asignar).toHaveBeenCalledExactlyOnceWith(20, 3));expect(guardado).toHaveBeenCalledOnce();
});
it('limpia vínculo sin enviar ni modificar texto histórico', async () => {
  vi.mocked(solicitudesApi.obtener).mockResolvedValue({ ...solicitud, medicoRemitenteId: 3, medicoRemitenteNombre: 'Ana Prueba' } as unknown as SolicitudDetalle);
  render(<RemitenteSolicitudModal solicitudId={20} onCerrar={vi.fn()} onGuardado={vi.fn()} />);
  await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());
  await userEvent.click(screen.getByRole('button', { name: 'Limpiar Médico del directorio' }));
  await userEvent.click(screen.getByRole('button', { name: 'Guardar remitente' }));
  await waitFor(() => expect(medicosApi.asignar).toHaveBeenCalledExactlyOnceWith(20, null));
});
