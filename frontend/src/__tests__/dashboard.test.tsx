import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../context/AuthContext';
import Dashboard from '../pages/Dashboard';
import { authApi, muestrasApi, resultadosApi } from '../services/laboratorio';
import type { EstadoMuestra, MuestraLista, ResultadoDetalle, RolNombre } from '../types/api';

vi.mock('../services/laboratorio', () => ({
  authApi: { perfil: vi.fn() },
  muestrasApi: { listar: vi.fn() },
  resultadosApi: { listar: vi.fn() },
}));

const FECHA = '2026-10-14T13:00:00.000Z';
const paciente = {
  id: 1, cedula: '10001', nombres: 'Ana', apellidos: 'Pérez', fechaNacimiento: FECHA,
  sexo: 'F' as const, telefono: null, email: null, direccion: null, createdAt: FECHA, updatedAt: FECHA,
};
const solicitud = {
  id: 1, codigo: 'SOL-2026-000001', pacienteId: 1, usuarioIdRegistra: 1,
  medicoSolicitante: null, diagnosticoPresuntivo: null, prioridad: 'URGENTE' as const,
  fechaSolicitud: FECHA, observaciones: null, createdAt: FECHA, updatedAt: FECHA, paciente,
};
const muestra = {
  id: 3, codigoBarras: 'M261014-ABC234', solicitudId: 1, tipoMuestra: 'Orina',
  sitioAnatomico: null, estado: 'EN_PROCESAMIENTO', fechaToma: FECHA,
  fechaRecepcion: FECHA, fechaProcesamiento: FECHA, usuarioIdRecepciona: 1,
  motivoRechazo: null, createdAt: FECHA, updatedAt: FECHA, solicitud, examenes: [],
} satisfies MuestraLista;
const resultado = {
  id: 7, muestraExamenId: 5, usuarioIdRegistra: 3, hallazgoGram: null, colonias: null,
  bacteriaAislada: 'Escherichia coli', observaciones: null, estado: 'PENDIENTE_VALIDACION',
  fechaRegistro: FECHA, usuarioIdValida: null, fechaValidacion: null, updatedAt: FECHA,
  antibiograma: [], registradoPor: { id: 3, username: 'bact', nombreCompleto: 'Carlos Gómez' },
  validadoPor: null,
  muestraExamen: {
    id: 5, muestraId: 3, examenId: 1, createdAt: FECHA, muestra,
    examen: {
      id: 1, codigo: 'URO-CUL', nombre: 'Urocultivo', tipoMuestraRequerida: 'Orina',
      descripcion: null, precio: '8.50', activo: true,
    },
  },
} satisfies ResultadoDetalle;

const indicadores: { estado: EstadoMuestra; etiqueta: string; total: number }[] = [
  { estado: 'REGISTRADA', etiqueta: 'Registrada', total: 11 },
  { estado: 'RECEPTADA', etiqueta: 'Receptada', total: 12 },
  { estado: 'EN_PROCESAMIENTO', etiqueta: 'En procesamiento', total: 13 },
  { estado: 'PROCESADA', etiqueta: 'Procesada', total: 14 },
  { estado: 'RECHAZADA', etiqueta: 'Rechazadas', total: 15 },
];

const casos: { rol: RolNombre; recepcion: boolean; resultados: string | null; filasValidacion: boolean }[] = [
  { rol: 'ADMINISTRADOR', recepcion: true, resultados: '/validacion', filasValidacion: true },
  { rol: 'RECEPCIONISTA', recepcion: true, resultados: null, filasValidacion: false },
  { rol: 'BACTERIOLOGO', recepcion: true, resultados: '/worklist', filasValidacion: false },
  { rol: 'VALIDADOR', recepcion: false, resultados: '/validacion', filasValidacion: true },
];

// Se observa el destino real del router sin montar las páginas de destino ni acceder al API.
function PanelDePrueba() {
  const { cargando } = useAuth();
  const ubicacion = useLocation();
  return (
    <>
      <output aria-label="Ruta actual">{ubicacion.pathname + ubicacion.search}</output>
      {!cargando && <Dashboard />}
    </>
  );
}

function entrar(rol: RolNombre) {
  localStorage.setItem('lab_token', 'token-de-prueba');
  vi.mocked(authApi.perfil).mockResolvedValue({ id: 9, username: 'prueba', nombreCompleto: 'Prueba', rol });
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AuthProvider><PanelDePrueba /></AuthProvider>
    </MemoryRouter>,
  );
}

function comprobarRuta(ruta: string) {
  expect(screen.getByLabelText('Ruta actual').textContent).toBe(ruta);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(muestrasApi.listar).mockImplementation(async (params) => ({
    data: params.estado ? [] : [muestra],
    total: indicadores.find((item) => item.estado === params.estado)?.total ?? 1,
    page: 1, pageSize: params.pageSize ?? 25, totalPages: 1,
  }));
  vi.mocked(resultadosApi.listar).mockResolvedValue({
    data: [resultado], total: 8, page: 1, pageSize: 8, totalPages: 1,
  });
});

describe.each(casos)('Navegación del Dashboard: $rol', ({ rol, recepcion, resultados, filasValidacion }) => {
  it('conserva los cinco conteos y solo permite navegar a recepción con permiso', async () => {
    entrar(rol);
    const usuario = userEvent.setup();
    const panel = await screen.findByRole('region', { name: 'Muestras por estado' });
    await within(panel).findByText('15');

    for (const { estado, etiqueta, total } of indicadores) {
      const indicador = within(panel).getByLabelText(`${etiqueta} ${total}`);
      expect(within(indicador).getByText(String(total))).toBeInTheDocument();
      expect(muestrasApi.listar).toHaveBeenCalledWith({ estado, pageSize: 1 });

      if (recepcion) {
        expect(within(panel).getByRole('button', { name: `${etiqueta} ${total}` })).toBe(indicador);
        expect(indicador).toBeEnabled();
        await usuario.click(indicador);
        comprobarRuta(`/recepcion?estado=${estado}`);
      } else {
        expect(indicador.tagName).toBe('DIV');
        expect(indicador).not.toHaveAttribute('role');
        expect(indicador).not.toHaveAttribute('tabindex');
        expect(indicador).not.toHaveAttribute('href');
        expect(indicador.className).not.toContain('hover:');
        expect(within(indicador).queryByRole('button')).not.toBeInTheDocument();
        expect(within(indicador).queryByRole('link')).not.toBeInTheDocument();
        await usuario.click(indicador);
        comprobarRuta('/dashboard');
      }
    }

  });

  it('permite usar el teclado y omite los indicadores sin permiso en el orden de foco', async () => {
    entrar(rol);
    const usuario = userEvent.setup();
    const panel = await screen.findByRole('region', { name: 'Muestras por estado' });
    await within(panel).findByText('15');
    await usuario.tab();
    const primerBoton = within(panel).getAllByRole('button')[0];
    // Los indicadores estáticos se omiten al navegar con el teclado.
    expect(primerBoton).toHaveFocus();
    await usuario.keyboard('{Enter}');
    comprobarRuta(recepcion ? '/recepcion' : '/validacion');
    await usuario.keyboard(' ');
    comprobarRuta(recepcion ? '/recepcion' : '/validacion');
  });

  it('mantiene la visibilidad, el conteo y el destino del indicador de resultados', async () => {
    entrar(rol);
    const usuario = userEvent.setup();
    const panel = await screen.findByRole('region', { name: 'Muestras por estado' });
    await within(panel).findByText('15');

    if (resultados) {
      const indicador = await within(panel).findByRole('button', { name: 'Resultados por validar 8' });
      expect(resultadosApi.listar).toHaveBeenCalledWith({ estado: 'PENDIENTE_VALIDACION', pageSize: 8 });
      await usuario.click(indicador);
      comprobarRuta(resultados);
    } else {
      expect(within(panel).queryByText('Resultados por validar')).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Esperando validación' })).not.toBeInTheDocument();
      expect(resultadosApi.listar).not.toHaveBeenCalled();
      comprobarRuta('/dashboard');
    }
  });

  it('mantiene los permisos y destinos de muestras y tareas pendientes', async () => {
    entrar(rol);
    const usuario = userEvent.setup();
    const filaMuestra = (await screen.findByText(muestra.codigoBarras)).closest('tr')!;
    if (resultados) await screen.findByText('Urocultivo');
    expect(screen.getAllByText('Pérez, Ana').length).toBe(resultados ? 2 : 1);
    expect(muestrasApi.listar).toHaveBeenCalledWith({ pageSize: 10 });

    if (recepcion) {
      expect(filaMuestra).toHaveAttribute('tabindex', '0');
      await usuario.click(filaMuestra);
      comprobarRuta('/recepcion?muestraId=3');
      filaMuestra.focus();
      await usuario.keyboard('{Enter}');
      comprobarRuta('/recepcion?muestraId=3');
    } else {
      expect(filaMuestra).not.toHaveAttribute('tabindex');
      await usuario.click(filaMuestra);
      comprobarRuta('/dashboard');
    }

    if (resultados) {
      const tarea = (await screen.findByText('Urocultivo')).closest('li')!;
      const filaResultado = within(tarea).queryByRole('button');
      if (filasValidacion) {
        expect(filaResultado).not.toBeNull();
        await usuario.click(filaResultado!);
        comprobarRuta('/validacion');
        filaResultado!.focus();
        await usuario.keyboard(' ');
        comprobarRuta('/validacion');
      } else {
        expect(filaResultado).toBeNull();
        await usuario.click(tarea);
        comprobarRuta('/recepcion?muestraId=3');
      }
    }
  });
});


describe.each(casos)('Resumen y accesos del panel: $rol', ({ rol, recepcion, resultados }) => {
  it('obtiene el total de los cinco estados existentes y limita los accesos al rol', async () => {
    entrar(rol);
    const total = (await screen.findByText('Total de muestras')).parentElement!;
    expect(await within(total).findByText('65')).toBeInTheDocument();
    const accesos = screen.getByRole('region', { name: 'Accesos rápidos' });
    expect(within(accesos).queryByRole('button', { name: /Pacientes y solicitudes/ }) !== null).toBe(['ADMINISTRADOR', 'RECEPCIONISTA'].includes(rol));
    expect(within(accesos).queryByRole('button', { name: /Recepción de muestras/ }) !== null).toBe(recepcion);
    expect(within(accesos).queryByRole('button', { name: /Ingresar resultados|Consultar worklist/ }) !== null).toBe(['ADMINISTRADOR', 'BACTERIOLOGO'].includes(rol));
    expect(within(accesos).queryByRole('button', { name: /Consultar resultados/ }) !== null).toBe(resultados !== null);
  });
});
