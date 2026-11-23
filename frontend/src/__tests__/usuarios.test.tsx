import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import App from '../App';
import { AuthProvider } from '../context/AuthContext';
import { authApi, usuariosApi } from '../services/laboratorio';
import type { RolNombre, UsuarioAdministracion } from '../types/api';

vi.mock('../services/laboratorio', () => ({
  authApi: { perfil: vi.fn(), login: vi.fn() },
  usuariosApi: { listar: vi.fn(), activar: vi.fn(), capacidades: vi.fn(), crear: vi.fn(), desactivar: vi.fn(), eliminar: vi.fn(), asignarPerfil: vi.fn() },
}));
const admin = { id: 7, username: 'admin', nombreCompleto: 'Administrador Prueba', email: 'admin@example.test', rol: 'ADMINISTRADOR' as const };
const pendiente: UsuarioAdministracion = { id: 42, username: 'pendiente', nombreCompleto: 'Persona Pendiente', email: 'pendiente@example.test', rol: 'BACTERIOLOGO', activo: false, createdAt: '2026-11-18T12:00:00Z' };
const adminInactivo: UsuarioAdministracion = { ...pendiente, id: 8, nombreCompleto: 'Administrador Inactivo', email: 'admin-inactivo@example.test', rol: 'ADMINISTRADOR' };
const filas = [pendiente, { ...admin, activo: true, createdAt: pendiente.createdAt }, adminInactivo];
const pagina = (data = filas) => ({ data, total: data.length, page: 1, pageSize: 25, totalPages: 1 });
const errorServidor = { isAxiosError: true, response: { status: 503, data: { error: { message: 'No se pudo completar la operación. Intente de nuevo.' } } } };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(authApi.perfil).mockResolvedValue(admin);
  vi.mocked(usuariosApi.capacidades).mockResolvedValue({ roles: ['BACTERIOLOGO'] });
  vi.mocked(usuariosApi.listar).mockResolvedValue(pagina());
  vi.mocked(usuariosApi.activar).mockResolvedValue({ id: pendiente.id, activo: true, eliminadoAt: null });
});
function abrir(rol: RolNombre | null = 'ADMINISTRADOR') {
  if (rol) {
    localStorage.setItem('lab_token', 'token-ficticio');
    vi.mocked(authApi.perfil).mockResolvedValue({ ...admin, rol });
  }
  return render(<MemoryRouter initialEntries={['/usuarios']}><AuthProvider><App /></AuthProvider></MemoryRouter>);
}
async function confirmar() {
  await userEvent.click(await screen.findByRole('button', { name: 'Activar usuario: Persona Pendiente' }));
  return screen.getByRole('dialog', { name: 'Confirmar activación' });
}
it('administración muestra estados y evita autoactivación o activación administrativa', async () => {
  abrir();
  const boton = await screen.findByRole('button', { name: 'Activar usuario: Persona Pendiente' });
  expect(boton).toBeEnabled();
  expect(within(boton.closest('tr')!).getByText('Inactivo')).toBeInTheDocument();
  expect(screen.getByText('Su cuenta · protegida')).toBeInTheDocument();
  expect(screen.getByText('Administración protegida')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /^Activar usuario:/ })).toHaveLength(1);
  expect(screen.getByRole('link', { name: 'Gestión de usuarios' })).toHaveAttribute('aria-current', 'page');
});
it('sin sesión envía a Login sin consultar usuarios', async () => {
  abrir(null); expect(await screen.findByRole('heading', { name: 'Tu espacio de trabajo' })).toBeInTheDocument();
  expect(usuariosApi.listar).not.toHaveBeenCalled();
});
for (const rol of ['RECEPCIONISTA', 'BACTERIOLOGO', 'VALIDADOR'] as const) it(`${rol}: oculta el menú y deniega la ruta de usuarios`, async () => {
  abrir(rol); expect(await screen.findByText('Acceso restringido')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Gestión de usuarios' })).not.toBeInTheDocument();
  expect(usuariosApi.listar).not.toHaveBeenCalled(); expect(usuariosApi.activar).not.toHaveBeenCalled();
});
it('solicita confirmación y permite cancelar sin activar', async () => {
  abrir(); const modal = await confirmar();
  expect(within(modal).getByText(pendiente.email)).toBeInTheDocument();
  expect(within(modal).getByText('Bacteriólogo')).toBeInTheDocument();
  expect(usuariosApi.activar).not.toHaveBeenCalled();
  await userEvent.click(within(modal).getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(usuariosApi.activar).not.toHaveBeenCalled();
});
it('activa una vez, muestra éxito y actualiza lista y estado', async () => {
  abrir(); const modal = await confirmar();
  const llamadas = vi.mocked(usuariosApi.listar).mock.calls.length;
  vi.mocked(usuariosApi.listar).mockResolvedValue(pagina(filas.map((u) => ({ ...u, activo: true }))));
  await userEvent.click(within(modal).getByRole('button', { name: 'Confirmar activación' }));
  expect(usuariosApi.activar).toHaveBeenCalledExactlyOnceWith(42);
  expect(await screen.findByText(/Se activó la cuenta de Persona Pendiente/)).toBeInTheDocument();
  await waitFor(() => expect(usuariosApi.listar).toHaveBeenCalledTimes(llamadas + 1));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  const fila = screen.getByText(pendiente.email).closest('tr')!;
  expect(within(fila).getByText('Activo')).toBeInTheDocument();
  expect(within(fila).queryByRole('button', { name: /^Activar usuario:/ })).not.toBeInTheDocument();
});
it('mientras activa bloquea duplicados, Escape, cancelar y cierre del modal', async () => {
  let resolver!: (valor: { id: number; activo: boolean; eliminadoAt: string | null }) => void;
  vi.mocked(usuariosApi.activar).mockReturnValue(new Promise((resolve) => { resolver = resolve; }));
  abrir(); const modal = await confirmar();
  const boton = within(modal).getByRole('button', { name: 'Confirmar activación' });
  fireEvent.click(boton); fireEvent.click(boton);
  expect(usuariosApi.activar).toHaveBeenCalledTimes(1); expect(boton).toBeDisabled();
  expect(within(modal).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  fireEvent.keyDown(window, { key: 'Escape' });
  fireEvent.click(within(modal).getByRole('button', { name: 'Cerrar' }));
  expect(modal).toBeInTheDocument();
  await act(async () => { vi.mocked(usuariosApi.listar).mockResolvedValue(pagina(filas.map(u => u.id === 42 ? { ...u, activo: true } : u))); resolver({ id: 42, activo: true, eliminadoAt: null }); });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  // El refresco obtiene el estado confirmado por el backend.
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Activar usuario: Persona Pendiente' })).not.toBeInTheDocument());
});
it('errores de activación conservan el estado y permiten reintentar', async () => {
  vi.mocked(usuariosApi.activar).mockRejectedValueOnce(errorServidor);
  abrir(); const modal = await confirmar();
  await userEvent.click(within(modal).getByRole('button', { name: 'Confirmar activación' }));
  expect(await within(modal).findByRole('alert')).toHaveTextContent('No se pudo completar la operación.');
  expect(within(modal).getByRole('button', { name: 'Confirmar activación' })).toBeEnabled();
  await userEvent.click(within(modal).getByRole('button', { name: 'Confirmar activación' }));
  expect(await screen.findByText(/Se activó la cuenta/)).toBeInTheDocument();
  expect(usuariosApi.activar).toHaveBeenCalledTimes(2);
});
it('muestra error de listado y puede volver a cargar', async () => {
  vi.mocked(usuariosApi.listar).mockRejectedValueOnce(errorServidor);
  abrir(); expect(await screen.findByText('No se pudo completar la operación. Intente de nuevo.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Actualizar lista' }));
  expect(await screen.findByText(pendiente.email)).toBeInTheDocument();
});
it('aplica búsqueda y filtro de estado al backend', async () => {
  abrir(); await screen.findByText(pendiente.email);
  await userEvent.click(screen.getByLabelText('Estado de la cuenta'));
  await userEvent.click(await screen.findByRole('option', { name: 'Inactivos' }));
  await waitFor(() => expect(usuariosApi.listar).toHaveBeenLastCalledWith({ q: '', estado: 'inactivos', page: 1, pageSize: 25 }));
  fireEvent.change(screen.getByLabelText('Buscar usuarios'), { target: { value: 'persona' } });
  await waitFor(() => expect(usuariosApi.listar).toHaveBeenLastCalledWith({ q: 'persona', estado: 'inactivos', page: 1, pageSize: 25 }));
});
it('el servicio real llama a los endpoints sin enviar roles ni permisos', async () => {
  const real = await vi.importActual<typeof import('../services/laboratorio')>('../services/laboratorio');
  const { api } = await import('../services/api');
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data: pagina() });
  const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: { data: { id: 42, activo: true } } });
  try {
    expect(await real.usuariosApi.listar({ estado: 'inactivos' })).toEqual(pagina());
    expect(get).toHaveBeenCalledWith('/usuarios', { params: { estado: 'inactivos' } });
    expect(await real.usuariosApi.activar(42)).toEqual({ id: 42, activo: true });
    expect(patch).toHaveBeenCalledWith('/usuarios/42/activar', {});
  } finally { get.mockRestore(); patch.mockRestore(); }
});

for (const accion of ['desactivar', 'eliminar'] as const) it(`${accion}: confirma, informa y actualiza sin recargar la aplicación`, async () => {
  const activa = { ...pendiente, activo: true };
  vi.mocked(usuariosApi.listar).mockResolvedValue(pagina([activa]));
  if (accion === 'desactivar') vi.mocked(usuariosApi.desactivar).mockResolvedValue({ id: 42, activo: false, eliminadoAt: null });
  else vi.mocked(usuariosApi.eliminar).mockResolvedValue({ id: 42, activo: false, eliminadoAt: fechaEliminacion });
  abrir();
  await userEvent.click(await screen.findByRole('button', { name: `${accion === 'desactivar' ? 'Desactivar' : 'Eliminar'} usuario: Persona Pendiente` }));
  const titulo = accion === 'desactivar' ? 'Confirmar desactivación' : 'Confirmar eliminación';
  const modal = screen.getByRole('dialog', { name: titulo });
  expect(within(modal).getByText('pendiente')).toBeInTheDocument();
  expect(usuariosApi[accion]).not.toHaveBeenCalled();
  vi.mocked(usuariosApi.listar).mockResolvedValue(pagina(accion === 'eliminar' ? [] : [{ ...activa, activo: false }]));
  await userEvent.click(within(modal).getByRole('button', { name: titulo }));
  expect(usuariosApi[accion]).toHaveBeenCalledExactlyOnceWith(42);
  expect(await screen.findByText(accion === 'eliminar' ? /Se eliminó la cuenta/ : /Se desactivó la cuenta/)).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  if (accion === 'eliminar') await waitFor(() => expect(screen.queryByText(pendiente.email)).not.toBeInTheDocument());
  else expect(await screen.findByRole('button', { name: 'Activar usuario: Persona Pendiente' })).toBeEnabled();
});
const fechaEliminacion = '2026-11-23T08:00:00Z';
it('eliminados muestran estado y no ofrecen reactivación ni acciones', async () => {
  vi.mocked(usuariosApi.listar).mockResolvedValue(pagina([{ ...pendiente, eliminadoAt: fechaEliminacion }]));
  abrir(); await screen.findByText(pendiente.email);
  expect(screen.getByText('Eliminado')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^(Activar|Desactivar|Eliminar) usuario:/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByLabelText('Estado de la cuenta'));
  await userEvent.click(await screen.findByRole('option', { name: 'Eliminados' }));
  await waitFor(() => expect(usuariosApi.listar).toHaveBeenLastCalledWith({ q: '', estado: 'eliminados', page: 1, pageSize: 25 }));
});
it('la asignación explícita a perfiles heredados ofrece solo los dos perfiles y mantiene inactividad', async () => {
  vi.mocked(usuariosApi.capacidades).mockResolvedValue({ roles: ['AUXILIAR', 'BACTERIOLOGO'] });
  vi.mocked(usuariosApi.listar).mockResolvedValue(pagina([{ ...pendiente, rol: 'RECEPCIONISTA' }]));
  vi.mocked(usuariosApi.asignarPerfil).mockResolvedValue({ id: 42, activo: false, rol: 'AUXILIAR' });
  abrir(); await screen.findByText('Pendiente de asignación');
  expect(screen.queryByRole('button', { name: 'Activar usuario: Persona Pendiente' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Asignar perfil: Persona Pendiente' }));
  const modal = screen.getByRole('dialog', { name: 'Asignar perfil operativo' });
  expect(within(modal).getByRole('button', { name: 'Guardar perfil' })).toBeDisabled();
  await userEvent.click(within(modal).getByLabelText('Perfil operativo'));
  expect(screen.getAllByRole('option').map(e => e.textContent)).toEqual(['Seleccione un perfil', 'Auxiliar', 'Bacteriólogo']);
  await userEvent.click(screen.getByRole('option', { name: 'Auxiliar' }));
  await userEvent.click(within(modal).getByRole('button', { name: 'Guardar perfil' }));
  expect(usuariosApi.asignarPerfil).toHaveBeenCalledExactlyOnceWith(42, 'AUXILIAR');
  expect(await screen.findByText(/La cuenta continúa inactiva/)).toBeInTheDocument();
  expect(usuariosApi.activar).not.toHaveBeenCalled();
});
it('el error de eliminación no muestra éxito ni retira la cuenta', async () => {
  vi.mocked(usuariosApi.eliminar).mockRejectedValue(errorServidor);
  abrir(); await userEvent.click(await screen.findByRole('button', { name: 'Eliminar usuario: Persona Pendiente' }));
  const modal = screen.getByRole('dialog', { name: 'Confirmar eliminación' });
  await userEvent.click(within(modal).getByRole('button', { name: 'Confirmar eliminación' }));
  expect(await within(modal).findByRole('alert')).toHaveTextContent('No se pudo completar');
  expect(screen.queryByText(/Se eliminó la cuenta/)).not.toBeInTheDocument();
  expect(within(modal).getByRole('button', { name: 'Confirmar eliminación' })).toBeEnabled();
});
it('servicio envía baja lógica y asignación por rutas privadas sin campos adicionales', async () => {
  const real = await vi.importActual<typeof import('../services/laboratorio')>('../services/laboratorio');
  const { api } = await import('../services/api');
  const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: { data: { id: 42, activo: false } } });
  const del = vi.spyOn(api, 'delete').mockResolvedValue({ data: { data: { id: 42, activo: false, eliminadoAt: fechaEliminacion } } });
  try {
    await real.usuariosApi.desactivar(42); expect(patch).toHaveBeenCalledWith('/usuarios/42/desactivar', {});
    await real.usuariosApi.asignarPerfil(42, 'AUXILIAR'); expect(patch).toHaveBeenCalledWith('/usuarios/42/perfil', { rol: 'AUXILIAR' });
    await real.usuariosApi.eliminar(42); expect(del).toHaveBeenCalledWith('/usuarios/42');
  } finally { patch.mockRestore(); del.mockRestore(); }
});
