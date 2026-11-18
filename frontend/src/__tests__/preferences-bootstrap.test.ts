import { beforeEach, expect, it, vi } from 'vitest';
import bootstrap from '../../public/preferences.js?raw';
import { api } from '../services/api';
import { authApi } from '../services/laboratorio';

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
});

it('aplica preferencias antes de montar React', () => {
  localStorage.setItem('labzen_preferences_v1', JSON.stringify({ tema: 'oscuro', densidad: 'compacta', reducirMovimiento: true }));
  new Function(bootstrap)();
  expect(document.documentElement.dataset).toMatchObject({ tema: 'oscuro', densidad: 'compacta', movimiento: 'reducido' });
});
it('el primer pintado usa sistema y tolera almacenamiento corrupto', () => {
  localStorage.setItem('labzen_preferences_v1', '{invalido');
  new Function(bootstrap)();
  expect(document.documentElement.dataset.tema).toBe('oscuro');
  expect(document.documentElement.dataset.densidad).toBe('comoda');
});
it('respeta tema claro explícito aunque el sistema esté oscuro', () => {
  localStorage.setItem('labzen_preferences_v1', JSON.stringify({ tema: 'claro' }));
  new Function(bootstrap)();
  expect(document.documentElement.dataset.tema).toBe('claro');
});
it('el servicio de registro usa el endpoint real y desempaqueta la respuesta', async () => {
  const cuerpo = { nombreCompleto: 'Persona Prueba', email: 'persona@example.test', password: 'ClaveSegura!123', confirmacion: 'ClaveSegura!123' };
  const post = vi.spyOn(api, 'post').mockResolvedValueOnce({ data: { data: { mensaje: 'Solicitud recibida.' } } });
  try {
    expect(await authApi.registrar(cuerpo)).toEqual({ mensaje: 'Solicitud recibida.' });
    expect(post).toHaveBeenCalledWith('/auth/register', cuerpo);
  } finally { post.mockRestore(); }
});
