import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import App from '../App';
import { AuthProvider } from '../context/AuthContext';
import { authApi, usuariosApi } from '../services/laboratorio';
import { autorizacionPara } from '../../../backend/src/domain/permisos';
import type { NuevoUsuarioAdministrativo, RolNombre, UsuarioAdministracion } from '../types/api';

vi.mock('../services/laboratorio', () => ({
  authApi: { perfil: vi.fn(), login: vi.fn() },
  usuariosApi: { listar: vi.fn(), activar: vi.fn(), capacidades: vi.fn(), crear: vi.fn() },
}));
const entrada: NuevoUsuarioAdministrativo = { nombreCompleto: 'Persona Nueva', username: 'persona.nueva', email: 'persona@example.test',
  password: 'ClaveSegura!123', confirmacion: 'ClaveSegura!123', rol: 'BACTERIOLOGO' };
const nueva: UsuarioAdministracion = { id: 42, username: entrada.username, nombreCompleto: entrada.nombreCompleto,
  email: entrada.email, rol: entrada.rol, activo: false, createdAt: '2026-11-22T12:00:00.000Z' };
const pagina = (data: UsuarioAdministracion[] = []) => ({ data, total: data.length, page: 1, pageSize: 25, totalPages: 1 });
const errorApi = (status: number, message: string, details?: unknown) => ({ isAxiosError: true, response: { status, data: { error: { message, details } } } });
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(usuariosApi.capacidades).mockResolvedValue({ roles: ['BACTERIOLOGO'] });
  vi.mocked(usuariosApi.listar).mockResolvedValue(pagina());
  vi.mocked(usuariosApi.crear).mockResolvedValue(nueva);
});
function abrir(rol: RolNombre | null = 'ADMINISTRADOR', sinPermisos = false) {
  if (rol) {
    localStorage.setItem('lab_token', 'token-ficticio');
    const autorizacion = autorizacionPara(rol, true);
    vi.mocked(authApi.perfil).mockResolvedValue({ id: 7, username: 'operador', nombreCompleto: 'Cuenta Prueba', rol,
      autorizacion: sinPermisos ? { ...autorizacion, permisos: [] } : autorizacion });
  }
  return render(<MemoryRouter initialEntries={['/usuarios']}><AuthProvider><App /></AuthProvider></MemoryRouter>);
}
async function formulario() {
  abrir(); const boton = await screen.findByRole('button', { name: 'Crear usuario' });
  await waitFor(() => expect(boton).toBeEnabled()); await userEvent.click(boton);
  return screen.findByRole('dialog', { name: 'Crear usuario' });
}
function rellenar(modal: HTMLElement, valores: Partial<NuevoUsuarioAdministrativo> = {}) {
  const datos = { ...entrada, ...valores };
  for (const [campo, etiqueta] of [['nombreCompleto', 'Nombre completo'], ['username', 'Nombre de usuario'], ['email', 'Correo electrónico'], ['password', 'Contraseña inicial'], ['confirmacion', 'Confirmar contraseña']] as const)
    fireEvent.change(within(modal).getByLabelText(etiqueta), { target: { value: datos[campo] } });
}
it('administración abre el modal existente con solo perfiles operativos y AUXILIAR deshabilitado si falta preparación', async () => {
  const modal = await formulario();
  expect(within(modal).getByText(/La cuenta se creará inactiva/)).toBeInTheDocument();
  expect(within(modal).getByText('El perfil auxiliar aún no está disponible.')).toBeInTheDocument();
  expect(within(modal).getByLabelText('Contraseña inicial')).toHaveAttribute('type', 'password');
  expect(within(modal).getByLabelText('Confirmar contraseña')).toHaveAttribute('type', 'password');
  await userEvent.click(within(modal).getByLabelText('Perfil operativo'));
  expect(screen.getByRole('option', { name: 'Auxiliar' })).toHaveAttribute('aria-disabled', 'true');
  expect(screen.queryByRole('option', { name: /Administrador|Recepción|Validador/ })).not.toBeInTheDocument();
  expect(usuariosApi.crear).not.toHaveBeenCalled();
});
it('crea cuenta pendiente, limpia el modal y refresca el listado sin cambiar la sesión', async () => {
  const modal = await formulario(); rellenar(modal, { username: ' PERSONA.NUEVA ', email: ' PERSONA@EXAMPLE.TEST ' });
  vi.mocked(usuariosApi.listar).mockResolvedValue(pagina([nueva]));
  const llamadas = vi.mocked(usuariosApi.listar).mock.calls.length;
  await userEvent.click(within(modal).getByRole('button', { name: 'Crear usuario' }));
  await waitFor(() => expect(usuariosApi.crear).toHaveBeenCalledExactlyOnceWith(entrada));
  expect(await screen.findByText(/Se creó la cuenta de Persona Nueva/)).toHaveTextContent('pendiente de activación');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await waitFor(() => expect(usuariosApi.listar).toHaveBeenCalledTimes(llamadas + 1));
  const fila = screen.getByText(nueva.email).closest('tr')!;
  expect(within(fila).getByText('Pendiente / inactivo')).toBeInTheDocument();
  expect(within(fila).getByRole('button', { name: 'Activar usuario: Persona Nueva' })).toBeEnabled();
  expect(authApi.login).not.toHaveBeenCalled(); expect(localStorage.getItem('lab_token')).toBe('token-ficticio');
  expect(document.querySelector('input[type="password"]')).not.toBeInTheDocument();
});
it('ofrece AUXILIAR solo como opción habilitada por las capacidades del servidor', async () => {
  vi.mocked(usuariosApi.capacidades).mockResolvedValue({ roles: ['AUXILIAR', 'BACTERIOLOGO'] });
  const modal = await formulario(); rellenar(modal);
  await userEvent.click(within(modal).getByLabelText('Perfil operativo'));
  await userEvent.click(screen.getByRole('option', { name: 'Auxiliar' }));
  await userEvent.click(within(modal).getByRole('button', { name: 'Crear usuario' }));
  await waitFor(() => expect(usuariosApi.crear).toHaveBeenCalledWith({ ...entrada, rol: 'AUXILIAR' }));
});
for (const [caso, datos] of [
  ['contraseña débil', { password: '123', confirmacion: '123' }], ['confirmación distinta', { confirmacion: 'otra' }],
  ['nombre ausente', { nombreCompleto: '' }], ['correo inválido', { email: 'sin-correo' }],
  ['usuario con @', { username: 'otra@example.test' }], ['contraseña superior a 72 bytes', { password: 'Á'.repeat(40) + 'a1!', confirmacion: 'Á'.repeat(40) + 'a1!' }],
] as const) it(`valida ${caso} antes de enviar al backend`, async () => {
  const modal = await formulario(); rellenar(modal, datos);
  await userEvent.click(within(modal).getByRole('button', { name: 'Crear usuario' }));
  expect(await within(modal).findByRole('alert')).toHaveTextContent('Revise los datos del formulario');
  expect(usuariosApi.crear).not.toHaveBeenCalled();
});
for (const [status, mensaje] of [[409, 'El nombre de usuario o correo ya está registrado.'], [403, 'No tiene permisos para administrar usuarios.'], [503, 'El perfil seleccionado aún no está disponible para crear cuentas.']] as const)
  it(`error ${status} conserva los datos y no confirma ni refresca una creación fallida`, async () => {
    vi.mocked(usuariosApi.crear).mockRejectedValue(errorApi(status, mensaje));
    const modal = await formulario(); rellenar(modal); const llamadas = vi.mocked(usuariosApi.listar).mock.calls.length;
    await userEvent.click(within(modal).getByRole('button', { name: 'Crear usuario' }));
    expect(await within(modal).findByRole('alert')).toHaveTextContent(mensaje);
    expect(within(modal).getByLabelText('Nombre de usuario')).toHaveValue(entrada.username);
    expect(screen.queryByText(/Se creó la cuenta/)).not.toBeInTheDocument();
    expect(usuariosApi.listar).toHaveBeenCalledTimes(llamadas);
  });
it('muestra los detalles de validación devueltos por el backend', async () => {
  vi.mocked(usuariosApi.crear).mockRejectedValue(errorApi(400, 'Los datos enviados no son válidos.', [{ campo: 'password', mensaje: 'Use como máximo 72 bytes' }]));
  const modal = await formulario(); rellenar(modal);
  await userEvent.click(within(modal).getByRole('button', { name: 'Crear usuario' }));
  expect(await within(modal).findByRole('alert')).toHaveTextContent('Use como máximo 72 bytes');
  expect(within(modal).getByLabelText('Contraseña inicial')).toHaveAttribute('aria-invalid', 'true');
});
it('bloquea doble envío, cancelación y cierre mientras guarda', async () => {
  let resolver!: (u: UsuarioAdministracion) => void;
  vi.mocked(usuariosApi.crear).mockReturnValue(new Promise(resolve => { resolver = resolve; }));
  const modal = await formulario(); rellenar(modal); const form = modal.querySelector('form')!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(usuariosApi.crear).toHaveBeenCalledOnce(); expect(within(modal).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  fireEvent.keyDown(window, { key: 'Escape' }); fireEvent.click(within(modal).getByRole('button', { name: 'Cerrar' }));
  expect(modal).toBeInTheDocument();
  await act(async () => resolver(nueva)); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('cancelar descarta la contraseña; volver a abrir muestra el formulario vacío', async () => {
  const modal = await formulario(); rellenar(modal);
  await userEvent.click(within(modal).getByRole('button', { name: 'Cancelar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Crear usuario' }));
  expect(screen.getByLabelText('Contraseña inicial')).toHaveValue(''); expect(screen.getByLabelText('Confirmar contraseña')).toHaveValue('');
  expect(usuariosApi.crear).not.toHaveBeenCalled();
});
it('si falla disponibilidad impide abrir el alta y permite volver a comprobar', async () => {
  vi.mocked(usuariosApi.capacidades).mockRejectedValueOnce(errorApi(503, 'No se pudo comprobar el catálogo.'));
  abrir(); expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo comprobar el catálogo.');
  expect(screen.getByRole('button', { name: 'Crear usuario' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Actualizar lista' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Crear usuario' })).toBeEnabled());
});
it('sin perfiles disponibles no permite abrir el formulario', async () => {
  vi.mocked(usuariosApi.capacidades).mockResolvedValue({ roles: [] }); abrir();
  expect(await screen.findByText(/No hay perfiles disponibles/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Crear usuario' })).toBeDisabled();
});
it('una revocación al refrescar capacidades impide reutilizar las opciones cargadas antes', async () => {
  abrir();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Crear usuario' })).toBeEnabled());
  vi.mocked(usuariosApi.capacidades).mockRejectedValueOnce(errorApi(403, 'No tiene permisos para administrar usuarios.'));
  await userEvent.click(screen.getByRole('button', { name: 'Actualizar lista' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No tiene permisos para administrar usuarios.');
  expect(screen.getByRole('button', { name: 'Crear usuario' })).toBeDisabled();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(usuariosApi.crear).not.toHaveBeenCalled();
});
for (const rol of ['AUXILIAR', 'BACTERIOLOGO', 'RECEPCIONISTA', 'VALIDADOR'] as const) it(`${rol}: no ve el formulario ni consulta capacidades administrativas`, async () => {
  abrir(rol); expect(await screen.findByText('Acceso restringido')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Crear usuario' })).not.toBeInTheDocument();
  expect(usuariosApi.capacidades).not.toHaveBeenCalled(); expect(usuariosApi.crear).not.toHaveBeenCalled();
});
it('administrador con capacidades explícitas revocadas tampoco accede al alta', async () => {
  abrir('ADMINISTRADOR', true); expect(await screen.findByText('Acceso restringido')).toBeInTheDocument();
  expect(usuariosApi.capacidades).not.toHaveBeenCalled();
});
it('sin sesión redirige a login sin consultar el catálogo', async () => {
  abrir(null); expect(await screen.findByRole('heading', { name: 'Tu espacio de trabajo' })).toBeInTheDocument();
  expect(usuariosApi.capacidades).not.toHaveBeenCalled(); expect(usuariosApi.crear).not.toHaveBeenCalled();
});
it('servicio real usa POST /usuarios y GET /usuarios/capacidades sin añadir rolId ni activar', async () => {
  const real = await vi.importActual<typeof import('../services/laboratorio')>('../services/laboratorio');
  const { api } = await import('../services/api');
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data: { data: { roles: ['BACTERIOLOGO'] } } });
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { data: nueva } });
  try {
    expect(await real.usuariosApi.capacidades()).toEqual({ roles: ['BACTERIOLOGO'] });
    expect(get).toHaveBeenCalledWith('/usuarios/capacidades');
    expect(await real.usuariosApi.crear(entrada)).toEqual(nueva); expect(post).toHaveBeenCalledWith('/usuarios', entrada);
  } finally { get.mockRestore(); post.mockRestore(); }
});
