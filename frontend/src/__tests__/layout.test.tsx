import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { SIDEBAR_KEY } from '../components/LayoutDesktop';
import { AuthProvider } from '../context/AuthContext';
import { PREFERENCES_KEY, PreferencesProvider } from '../context/PreferencesContext';
import { ToastProvider } from '../context/ToastContext';
import { authApi } from '../services/laboratorio';

vi.mock('../services/laboratorio', () => ({
  authApi: { perfil: vi.fn() },
  pacientesApi: { capacidades: vi.fn(async () => ({ identificacionPacientes: false })), listar: vi.fn(async () => ({ data: [], total: 0, page: 1, totalPages: 1 })) },
}));

let ancho = 1280;
const consultas = new Map<string, { matches: boolean; listeners: Set<() => void> }>();
function redimensionar(valor: number) {
  act(() => {
    ancho = valor;
    Object.defineProperty(window, 'innerWidth', { value: valor, configurable: true });
    consultas.forEach((consulta, query) => {
      const maximo = query.match(/max-width: (\d+)px/);
      const siguiente = maximo ? valor <= Number(maximo[1]) : false;
      if (siguiente !== consulta.matches) {
        consulta.matches = siguiente;
        consulta.listeners.forEach((fn) => fn());
      }
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  consultas.clear();
  redimensionar(1280);
  vi.stubGlobal('matchMedia', (query: string) => {
    if (!consultas.has(query)) {
      const maximo = query.match(/max-width: (\d+)px/);
      consultas.set(query, { matches: maximo ? ancho <= Number(maximo[1]) : false, listeners: new Set() });
    }
    const consulta = consultas.get(query)!;
    return {
      get matches() { return consulta.matches; },
      addEventListener: (_: string, fn: () => void) => consulta.listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => consulta.listeners.delete(fn),
    };
  });
  vi.mocked(authApi.perfil).mockResolvedValue({ id: 9, username: 'recepcion', nombreCompleto: 'Persona Prueba', rol: 'RECEPCIONISTA' });
});
afterEach(() => { vi.restoreAllMocks(); });

function abrir(ruta = '/configuracion', autenticado = true) {
  if (autenticado) localStorage.setItem('lab_token', 'sesion-de-prueba');
  return render(<MemoryRouter initialEntries={[ruta]}><PreferencesProvider><ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider></PreferencesProvider></MemoryRouter>);
}

describe('Sidebar interno', () => {
  it('contrae por teclado, conserva nombres y restaura la preferencia al volver a abrir', async () => {
    const app = abrir();
    const usuario = userEvent.setup();
    const alternar = await screen.findByRole('button', { name: 'Contraer menú' });
    expect(alternar).toHaveAttribute('aria-expanded', 'true');
    alternar.focus();
    await usuario.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Expandir menú' })).toHaveAttribute('aria-expanded', 'false');
    expect(localStorage.getItem(SIDEBAR_KEY)).toBe('true');
    expect(screen.getByRole('link', { name: 'Admisión de pacientes' })).toHaveAttribute('title', 'Admisión de pacientes');
    app.unmount();
    abrir();
    await usuario.click(await screen.findByRole('button', { name: 'Expandir menú' }));
    expect(localStorage.getItem(SIDEBAR_KEY)).toBe('false');
    expect(screen.getByRole('button', { name: 'Contraer menú' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('ofrece ayuda al enfocar un icono y permite navegar con Enter', async () => {
    localStorage.setItem(SIDEBAR_KEY, 'true');
    abrir();
    const usuario = userEvent.setup();
    const enlace = await screen.findByRole('link', { name: 'Admisión de pacientes' });
    act(() => enlace.focus());
    expect(screen.getByRole('tooltip')).toHaveTextContent('Admisión de pacientes');
    expect(enlace).toHaveAccessibleDescription('Admisión de pacientes');
    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await usuario.keyboard('{Enter}');
    expect(await screen.findByRole('heading', { name: 'Pacientes' })).toBeInTheDocument();
    expect(enlace).toHaveAttribute('aria-current', 'page');
  });

  it('comienza compacto en tablet y permite expandirlo sin una restricción CSS por tamaño', async () => {
    redimensionar(900);
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Expandir menú' }));
    expect(screen.getByRole('button', { name: 'Contraer menú' })).toBeInTheDocument();
  });

  it('tolera almacenamiento no disponible sin perder la navegación', async () => {
    const leer = localStorage.getItem.bind(localStorage);
    const guardar = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, 'getItem').mockImplementation((key) => {
      if (key === SIDEBAR_KEY) throw new Error('Almacenamiento bloqueado');
      return leer(key);
    });
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === SIDEBAR_KEY) throw new Error('Almacenamiento bloqueado');
      guardar(key, value);
    });
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Contraer menú' }));
    expect(screen.getByRole('button', { name: 'Expandir menú' })).toBeInTheDocument();
  });

  it('conserva tema, densidad y movimiento al alternar el menú', async () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ tema: 'oscuro', densidad: 'compacta', reducirMovimiento: true, avisosInformativos: false }));
    abrir();
    const anteriores = localStorage.getItem(PREFERENCES_KEY);
    await userEvent.click(await screen.findByRole('button', { name: 'Contraer menú' }));
    expect(localStorage.getItem(PREFERENCES_KEY)).toBe(anteriores);
    expect(document.documentElement).toHaveAttribute('data-tema', 'oscuro');
    expect(document.documentElement).toHaveAttribute('data-densidad', 'compacta');
    expect(document.documentElement).toHaveAttribute('data-movimiento', 'reducido');
  });
});

describe('Menú móvil', () => {
  beforeEach(() => redimensionar(375));

  it('aísla el fondo, contiene Tab y devuelve el foco al cerrar con Escape', async () => {
    abrir();
    const usuario = userEvent.setup();
    const origen = await screen.findByRole('button', { name: 'Abrir menú de navegación' });
    expect(screen.queryByRole('navigation', { name: 'Principal' })).not.toBeInTheDocument();
    await usuario.click(origen);
    const dialogo = screen.getByRole('dialog', { name: 'Menú de navegación' });
    expect(dialogo).toHaveFocus();
    expect(origen.closest('.lz-layout')?.parentElement).toHaveAttribute('inert');
    await usuario.tab({ shift: true });
    expect(within(dialogo).getByRole('button', { name: 'Cerrar sesión' })).toHaveFocus();
    await usuario.tab();
    expect(within(dialogo).getByRole('button', { name: 'Cerrar' })).toHaveFocus();
    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(origen).toHaveFocus();
    expect(origen).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('[inert]')).toBeNull();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('cierra con el fondo y al navegar, incluso a la ruta actual', async () => {
    abrir();
    const usuario = userEvent.setup();
    const origen = await screen.findByRole('button', { name: 'Abrir menú de navegación' });
    await usuario.click(origen);
    fireEvent.click(document.querySelector('[data-modal-layer] > [aria-hidden]')!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await usuario.click(origen);
    await usuario.click(screen.getByRole('link', { name: 'Configuración' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await usuario.click(origen);
    await usuario.click(screen.getByRole('link', { name: 'Admisión de pacientes' }));
    expect(await screen.findByRole('heading', { name: 'Pacientes' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem(SIDEBAR_KEY)).toBeNull();
  });

  it('restaura escritorio al redimensionar sin conservar un fondo inerte', async () => {
    localStorage.setItem(SIDEBAR_KEY, 'false');
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir menú de navegación' }));
    redimensionar(1280);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Contraer menú' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
    expect(document.querySelector('[inert]')).toBeNull();
  });
});

describe('Aislamiento de la identidad interna', () => {
  it('propaga la identidad al modal de pacientes renderizado fuera del layout', async () => {
    abrir('/admision');
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar paciente' }));
    const modal = screen.getByRole('dialog', { name: 'Registrar paciente' });
    expect(modal.closest('[data-modal-layer]')).toHaveClass('labzen-internal');
    expect(document.querySelector('.lz-layout')).not.toContainElement(modal);
  });

  for (const ruta of ['/login', '/registro']) it(`${ruta}: no monta el ámbito interno ni la fuente Plex`, () => {
    abrir(ruta, false);
    expect(document.querySelector('.labzen-internal')).toBeNull();
    expect(document.querySelector('link[href*="IBM"]')).toBeNull();
    expect(screen.queryByRole('button', { name: /menú/ })).not.toBeInTheDocument();
  });

  it('retira ámbito y fuente interna al cerrar sesión', async () => {
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('heading', { name: 'Tu espacio de trabajo' })).toBeInTheDocument();
    expect(document.querySelector('.labzen-internal')).toBeNull();
    expect(document.querySelector('link[href*="IBM"]')).toBeNull();
  });
});
