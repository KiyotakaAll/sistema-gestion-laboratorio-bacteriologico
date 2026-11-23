import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { AuthProvider } from '../context/AuthContext';
import { PreferencesProvider, PREFERENCES_KEY, usePreferences } from '../context/PreferencesContext';
import { ToastProvider, useToast } from '../context/ToastContext';
import { authApi } from '../services/laboratorio';
import { validarRegistro } from '../utils/registro';
import type { RolNombre } from '../types/api';

vi.mock('../services/laboratorio', () => ({ authApi: { registrar: vi.fn(), perfil: vi.fn(), login: vi.fn() } }));
const datos = { nombreCompleto: 'Persona Prueba', email: 'persona@example.test', password: 'ClaveSegura!123', confirmacion: 'ClaveSegura!123' };
const mensaje = 'Solicitud recibida. La cuenta quedará pendiente de activación.';
const usuario = { id: 8, username: 'prueba', nombreCompleto: 'Persona Prueba', email: datos.email, rol: 'RECEPCIONISTA' as RolNombre };
let oscuroSistema = false;
let alCambiarSistema: (() => void) | undefined;
beforeEach(() => {
  vi.clearAllMocks(); oscuroSistema = false; alCambiarSistema = undefined;
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    get matches() { return query === '(prefers-color-scheme: dark)' && oscuroSistema; },
    addEventListener: (_: string, fn: () => void) => { if (query === '(prefers-color-scheme: dark)') alCambiarSistema = fn; },
    removeEventListener: vi.fn(),
  })));
  vi.mocked(authApi.registrar).mockResolvedValue({ mensaje });
  vi.mocked(authApi.perfil).mockResolvedValue(usuario);
});
function abrir(ruta = '/registro') {
  return render(<MemoryRouter initialEntries={[ruta]}><PreferencesProvider><ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider></PreferencesProvider></MemoryRouter>);
}
function completar() {
  for (const [etiqueta, value] of [['Nombre completo', datos.nombreCompleto], ['Correo electrónico', datos.email], ['Contraseña', datos.password], ['Confirmar contraseña', datos.confirmacion]] as const)
    fireEvent.change(screen.getByLabelText(etiqueta, { exact: true }), { target: { value } });
}

describe('Registro público', () => {
  it('abre el registro desde Login y permite volver por teclado', async () => {
    abrir('/login'); const u = userEvent.setup();
    await u.click(screen.getByRole('link', { name: 'Crear cuenta' }));
    expect(screen.getByRole('heading', { name: 'Crear cuenta' })).toBeInTheDocument();
    screen.getByRole('link', { name: 'Volver a iniciar sesión' }).focus();
    await u.keyboard('{Enter}');
    expect(screen.getByRole('heading', { name: 'Tu espacio de trabajo' })).toBeInTheDocument();
  });
  it('valida campos, correo, longitud en bytes, claves comunes y confirmación sin exigir composición', () => {
    expect(validarRegistro(datos)).toEqual({});
    for (const cambio of [{ nombreCompleto: '' }, { email: '' }, { email: 'invalido' }, { password: '123' }, { password: '12345678', confirmacion: '12345678' }, { password: 'Á'.repeat(40) + 'a1!' }, { confirmacion: 'otra' }])
      expect(Object.keys(validarRegistro({ ...datos, ...cambio })).length).toBeGreaterThan(0);
    for (const password of ['calmaluz', 'sinmayuscula!123', 'SINMINUSCULA!123', 'SinNumero!!!!', 'SinSimbolos123', 'mi mesa tiene libros'])
      expect(validarRegistro({ ...datos, password, confirmacion: password })).toEqual({});
  });
  it('no envía inválidos y enfoca el primer campo con error', async () => {
    abrir(); await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(authApi.registrar).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Nombre completo')).toHaveFocus();
    expect(screen.getByLabelText('Nombre completo')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getAllByRole('alert')).toHaveLength(4);
  });
  it('muestra y oculta ambas contraseñas', async () => {
    abrir(); const u = userEvent.setup();
    for (const [etiqueta, boton] of [['Contraseña', 'contraseña'], ['Confirmar contraseña', 'confirmación']] as const) {
      await u.click(screen.getByRole('button', { name: `Mostrar ${boton}` }));
      expect(screen.getByLabelText(etiqueta, { exact: true })).toHaveAttribute('type', 'text');
      await u.click(screen.getByRole('button', { name: `Ocultar ${boton}` }));
      expect(screen.getByLabelText(etiqueta, { exact: true })).toHaveAttribute('type', 'password');
    }
  });
  it('envía al backend sin rol, bloquea envíos duplicados y no inicia sesión', async () => {
    let resolver!: (valor: { mensaje: string }) => void;
    vi.mocked(authApi.registrar).mockReturnValue(new Promise((resolve) => { resolver = resolve; }));
    abrir(); completar();
    const boton = screen.getByRole('button', { name: 'Crear cuenta' });
    fireEvent.click(boton); fireEvent.submit(boton.closest('form')!);
    expect(authApi.registrar).toHaveBeenCalledTimes(1);
    expect(authApi.registrar).toHaveBeenCalledWith(datos);
    expect(boton).toBeDisabled();
    await act(async () => { resolver({ mensaje }); });
    expect(screen.getByText(mensaje).closest('[role="status"]')).toBeInTheDocument();
    expect(localStorage.getItem('lab_token')).toBeNull(); expect(authApi.login).not.toHaveBeenCalled();
    expect(screen.queryByRole('navigation', { name: 'Principal' })).not.toBeInTheDocument();
  });
  it('muestra el error del servidor y permite reintentar', async () => {
    vi.mocked(authApi.registrar).mockRejectedValueOnce({ isAxiosError: true, response: { status: 503, data: { error: { message: 'Registro no disponible.' } } } });
    abrir(); completar(); await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Registro no disponible.');
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect((await screen.findByText(mensaje)).closest('[role="status"]')).toBeInTheDocument();
  });
});

describe('Configuración y Sidebar', () => {
  function entrar(rol: RolNombre = 'RECEPCIONISTA') {
    localStorage.setItem('lab_token', 'token-ficticio');
    vi.mocked(authApi.perfil).mockResolvedValue({ ...usuario, rol });
    return abrir('/configuracion');
  }
  it('aplica y persiste el tema; lo restaura al abrir de nuevo', async () => {
    const app = entrar(); const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Oscuro' }));
    expect(document.documentElement).toHaveAttribute('data-tema', 'oscuro');
    expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY)!)).toMatchObject({ tema: 'oscuro' });
    app.unmount(); entrar();
    expect(await screen.findByRole('button', { name: 'Oscuro' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement).toHaveAttribute('data-tema', 'oscuro');
    await u.click(screen.getByRole('button', { name: 'Claro' }));
    expect(document.documentElement).toHaveAttribute('data-tema', 'claro');
  });
  it('sigue los cambios del sistema mientras esa opción esté seleccionada', async () => {
    entrar(); await screen.findByRole('button', { name: 'Sistema' });
    act(() => { oscuroSistema = true; alCambiarSistema?.(); });
    expect(document.documentElement).toHaveAttribute('data-tema', 'oscuro');
    await userEvent.click(screen.getByRole('button', { name: 'Claro' }));
    act(() => { alCambiarSistema?.(); });
    expect(document.documentElement).toHaveAttribute('data-tema', 'claro');
  });
  it('aplica densidad y movimiento; restablecer persiste valores predeterminados', async () => {
    entrar(); const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Oscuro' }));
    await u.click(screen.getByLabelText('Compacta'));
    await u.click(screen.getByLabelText('Reducir animaciones y transiciones'));
    await u.click(screen.getByLabelText('Mostrar avisos de éxito e información'));
    expect(document.documentElement).toHaveAttribute('data-densidad', 'compacta');
    expect(document.documentElement).toHaveAttribute('data-movimiento', 'reducido');
    await u.click(screen.getByRole('button', { name: 'Restablecer preferencias' }));
    expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY)!)).toEqual({ tema: 'sistema', densidad: 'comoda', reducirMovimiento: false, avisosInformativos: true });
    expect(document.documentElement).toHaveAttribute('data-densidad', 'comoda');
    expect(document.documentElement).toHaveAttribute('data-movimiento', 'sistema');
    expect(screen.getByText('Preferencias restablecidas.')).toHaveAttribute('role', 'status');
  });
  it('muestra los datos reales del perfil sin tokens ni edición ficticia', async () => {
    entrar(); expect(await screen.findByText(datos.email)).toBeInTheDocument();
    expect(screen.getAllByText(usuario.nombreCompleto).length).toBeGreaterThan(0);
    expect(screen.queryByText('token-ficticio')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
  });
  for (const rol of ['ADMINISTRADOR', 'RECEPCIONISTA', 'BACTERIOLOGO', 'VALIDADOR'] as const) {
    it(`${rol}: configuración inferior activa, accesible y salida real`, async () => {
      entrar(rol); const u = userEvent.setup();
      const configuracion = await screen.findByRole('link', { name: 'Configuración' });
      expect(configuracion).toHaveAttribute('aria-current', 'page');
      expect(within(screen.getByRole('navigation', { name: 'Principal' })).queryByRole('link', { name: 'Configuración' })).toBeNull();
      configuracion.focus(); await u.keyboard('{Enter}');
      expect(screen.getByRole('heading', { name: 'Configuración' })).toBeInTheDocument();
      await u.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
      expect(await screen.findByRole('heading', { name: 'Tu espacio de trabajo' })).toBeInTheDocument();
      expect(localStorage.getItem('lab_token')).toBeNull();
    });
  }
  it('desactivar avisos informativos conserva los errores reales', async () => {
    function Avisos() {
      const { actualizar } = usePreferences(); const toast = useToast();
      return <><button onClick={() => actualizar({ avisosInformativos: false })}>Silenciar</button><button onClick={() => toast.exito('Operación guardada')}>Éxito</button><button onClick={() => toast.error('No se pudo guardar')}>Error</button></>;
    }
    render(<PreferencesProvider><ToastProvider><Avisos /></ToastProvider></PreferencesProvider>);
    const u = userEvent.setup(); await u.click(screen.getByText('Silenciar')); await u.click(screen.getByText('Éxito'));
    expect(screen.queryByText('Operación guardada')).toBeNull();
    await u.click(screen.getByText('Error'));
    expect(screen.getByText('No se pudo guardar')).toBeInTheDocument();
  });
  it('tolera preferencias corruptas', async () => {
    localStorage.setItem(PREFERENCES_KEY, 'no-json'); entrar();
    expect(await screen.findByRole('button', { name: 'Sistema' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-tema', 'claro'));
  });
});
