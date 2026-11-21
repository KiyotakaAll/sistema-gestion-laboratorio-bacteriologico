import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import Login from '../pages/Login';
import { authApi } from '../services/laboratorio';
import { TOKEN_KEY } from '../services/api';

vi.mock('../services/laboratorio', () => ({ authApi: { login: vi.fn(), perfil: vi.fn(), registrar: vi.fn() } }));
const sesion = {
  token: 'token-solo-pruebas',
  usuario: { id: 7, username: 'personal', nombreCompleto: 'Persona Prueba', email: 'persona@example.test', rol: 'BACTERIOLOGO' as const },
};
beforeEach(() => vi.clearAllMocks());
function abrir(state?: { from: string }) {
  return render(<MemoryRouter initialEntries={[{ pathname: '/login', state }]}><AuthProvider><Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/registro" element={<Login />} />
    <Route path="/dashboard" element={<h1>Panel autenticado</h1>} />
    <Route path="/worklist" element={<h1>Destino solicitado</h1>} />
  </Routes></AuthProvider></MemoryRouter>);
}
function completar(usuario = 'persona@example.test') {
  fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: usuario } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'ClaveSegura!123' } });
}

describe('Acceso público v5 con AuthContext real', () => {
  it('monta todas las secciones y las anclas apuntan a destinos existentes', () => {
    const { container } = abrir();
    expect([...container.querySelectorAll('section')].map((s) => s.id)).toEqual([
      'inicio', 'conoce', 'funciones', 'pacientes', 'muestras', 'resultados', 'seguridad', 'cierre',
    ]);
    for (const a of container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
      expect(document.getElementById(a.hash.slice(1))).not.toBeNull();
    }
    expect(container.querySelector('.labzen-internal')).toBeNull();
    expect(container.querySelector('.hero-atmosphere')).toHaveAttribute('aria-hidden', 'true');
  });
  it('exige credenciales y permite mostrar y ocultar la contraseña', async () => {
    abrir();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeDisabled();
    completar();
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
  });
  it('envía el correo al servicio real, bloquea duplicados y redirige al destino solicitado', async () => {
    let resolver!: (valor: typeof sesion) => void;
    vi.mocked(authApi.login).mockReturnValue(new Promise((r) => { resolver = r; }));
    abrir({ from: '/worklist' }); completar('  persona@example.test  ');
    const form = screen.getByRole('form', { name: 'Inicio de sesión' });
    fireEvent.submit(form); fireEvent.submit(form);
    expect(authApi.login).toHaveBeenCalledExactlyOnceWith('persona@example.test', 'ClaveSegura!123');
    expect(form).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Verificando acceso...' })).toBeDisabled();
    await act(async () => resolver(sesion));
    expect(await screen.findByRole('heading', { name: 'Destino solicitado' })).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBe(sesion.token);
  });
  it('muestra el error del servidor, permite reintentar con usuario y abre dashboard', async () => {
    vi.mocked(authApi.login).mockRejectedValueOnce({ isAxiosError: true, response: { status: 401, data: { error: { message: 'Cuenta inactiva.' } } } }).mockResolvedValueOnce(sesion);
    abrir(); completar('personal');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cuenta inactiva.');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByRole('heading', { name: 'Panel autenticado' })).toBeInTheDocument();
    expect(authApi.login).toHaveBeenLastCalledWith('personal', 'ClaveSegura!123');
  });
  it('espera la validación de una sesión guardada antes de redirigir', async () => {
    let resolver!: (valor: typeof sesion.usuario) => void;
    localStorage.setItem(TOKEN_KEY, sesion.token);
    vi.mocked(authApi.perfil).mockReturnValue(new Promise((r) => { resolver = r; }));
    abrir();
    expect(screen.getByRole('status')).toHaveTextContent('Cargando sesión...');
    expect(screen.queryByRole('form')).toBeNull();
    await act(async () => resolver(sesion.usuario));
    expect(await screen.findByRole('heading', { name: 'Panel autenticado' })).toBeInTheDocument();
  });
  it('una sesión caducada vuelve al login y conserva el contenido público', async () => {
    localStorage.setItem(TOKEN_KEY, 'caducado');
    vi.mocked(authApi.perfil).mockRejectedValue(new Error('Sesión caducada'));
    abrir();
    expect(await screen.findByRole('heading', { name: 'Tu espacio de trabajo' })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Acceso · LabZen'));
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(document.querySelector('#seguridad')).not.toBeNull();
  });
});
